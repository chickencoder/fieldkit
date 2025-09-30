import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { config } from "dotenv";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type {
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { v4 as uuidv4 } from "uuid";

import { logger } from "./utils/logger";
import type { MessagePart, UserMessage, StreamingState } from "./types";

config();

if (!process.env.CONVEX_URL) {
  logger.error("CONVEX_URL environment variable is required");
  process.exit(1);
}

if (!process.env.SESSION_ID) {
  logger.error("SESSION_ID environment variable is required");
  process.exit(1);
}

logger.info("Starting sandbox worker", {
  nodeVersion: process.version,
  platform: process.platform,
  cwd: process.cwd(),
  convexUrl: process.env.CONVEX_URL?.substring(0, 50) + "...",
  sandboxId: process.env.SANDBOX_ID,
  sessionId: process.env.SESSION_ID,
});

const client = new ConvexClient(process.env.CONVEX_URL!);
const sandboxId = process.env.SANDBOX_ID || `sandbox-${Date.now()}`;
const sessionId = process.env.SESSION_ID! as Id<"sessions">;

async function* generateUserMessages() {
  while (true) {
    const message = await new Promise<UserMessage | null>((resolve) => {
      if (streamingState.messageQueue.length > 0) {
        const nextMessage = streamingState.messageQueue.shift();
        resolve(nextMessage || null);
      } else {
        streamingState.messageQueueResolver = resolve;
      }
    });

    if (!message) continue;

    const userContent = message.parts
      ?.map((part: MessagePart) => {
        if (typeof part === "string") return part;
        return part.text || part.content || JSON.stringify(part);
      })
      .filter(Boolean)
      .join(" ");

    if (!userContent?.trim()) continue;

    if (!streamingState.currentProcessingMessage) {
      streamingState.currentProcessingMessage = message;
    }

    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: userContent,
      },
      parent_tool_use_id: null,
      session_id: streamingState.currentSessionId || sandboxId,
    };
  }
}

async function processStreamingSession() {
  if (streamingState.isStreamingSessionActive) return;

  streamingState.isStreamingSessionActive = true;
  const sessionOperation = logger.operation("streaming-session", {});

  try {
    let resumeSessionId: string | null = null;
    try {
      const currentSession = await client.query(api.sessions.getSessionById, {
        sessionId: sessionId,
      });

      if (currentSession?.agentSessionId) {
        const existingMessages = await client.query(
          api.sessions.getMessagesBySessionId,
          { sessionId: sessionId },
        );

        if (existingMessages.length > 0) {
          resumeSessionId = currentSession.agentSessionId;
        }
      }
    } catch (error) {
      // No previous session found
    }

    const queryOptions: Options = {
      permissionMode: "acceptEdits",
      maxTurns: 50,
      model: "claude-sonnet-4-5-20250929",
      systemPrompt: { type: "preset", preset: "claude_code" },
      settingSources: [],
      includePartialMessages: true,
      ...(resumeSessionId && { resume: resumeSessionId }),
    };

    if (resumeSessionId) {
      streamingState.currentSessionId = resumeSessionId;
    }

    const claudeQuery = query({
      prompt: generateUserMessages(),
      options: queryOptions,
    });

    let currentAssistantMessageId: string | null = null;
    let currentMessageChunks: Array<TextBlock | ToolUseBlock> = [];
    let currentUserMessageId: string | null = null;

    for await (const message of claudeQuery) {
      if (message.type === "user") {
        // Tool results from Claude - continue building the same assistant message
        continue;
      }

      if (message.type === "stream_event") {
        if (message.event.type === "content_block_start") {
          if (!currentAssistantMessageId) {
            currentAssistantMessageId = uuidv4();
            currentUserMessageId =
              streamingState.currentProcessingMessage?.id || null;
            streamingState.currentProcessingMessage = null;
          }

          const block = message.event.content_block;

          if (block.type === "text") {
            currentMessageChunks.push({
              type: "text" as const,
              text: block.text || "",
              citations: [],
            });
          } else if (block.type === "tool_use") {
            currentMessageChunks.push({
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: "",
            });
          }

          await updateAssistantMessage(
            currentAssistantMessageId,
            currentMessageChunks,
            currentUserMessageId,
            false,
          );
        } else if (message.event.type === "content_block_delta") {
          const lastChunk =
            currentMessageChunks[currentMessageChunks.length - 1];

          if (
            message.event.delta.type === "text_delta" &&
            lastChunk?.type === "text"
          ) {
            currentMessageChunks[currentMessageChunks.length - 1] = {
              ...lastChunk,
              text: lastChunk.text + message.event.delta.text,
            };
          } else if (
            message.event.delta.type === "input_json_delta" &&
            lastChunk?.type === "tool_use"
          ) {
            currentMessageChunks[currentMessageChunks.length - 1] = {
              ...lastChunk,
              input:
                (lastChunk.input as string) + message.event.delta.partial_json,
            };
          }

          if (currentAssistantMessageId) {
            await updateAssistantMessage(
              currentAssistantMessageId,
              currentMessageChunks,
              currentUserMessageId,
              false,
            );
          }
        } else if (message.event.type === "content_block_stop") {
          const lastChunk =
            currentMessageChunks[currentMessageChunks.length - 1];

          if (
            lastChunk?.type === "tool_use" &&
            typeof lastChunk.input === "string"
          ) {
            try {
              lastChunk.input = JSON.parse(lastChunk.input);
            } catch (error) {
              logger.error("Failed to parse tool input JSON", error as Error, {
                toolName: lastChunk.name,
                toolId: lastChunk.id,
              });
            }
          }

          if (currentAssistantMessageId) {
            await updateAssistantMessage(
              currentAssistantMessageId,
              currentMessageChunks,
              currentUserMessageId,
              false,
            );
          }
        }
      } else if (message.type === "result") {
        if (currentAssistantMessageId && currentMessageChunks.length > 0) {
          await finalizeAssistantMessage(
            currentAssistantMessageId,
            currentMessageChunks,
            currentUserMessageId,
          );
          currentAssistantMessageId = null;
          currentMessageChunks = [];
          currentUserMessageId = null;
        }
      } else if (message.type === "system") {
        if (message.subtype === "init" && message.session_id) {
          streamingState.currentSessionId = message.session_id;

          try {
            await client.mutation(api.sessions.updateSessionWithAgentId, {
              sessionId: sessionId,
              agentSessionId: message.session_id,
            });
          } catch (error) {
            logger.error(
              "Failed to update session with agent ID",
              error as Error,
            );
          }
        }
      }
    }

    sessionOperation.success("Streaming session completed");
  } catch (error) {
    sessionOperation.error("Streaming session failed", error as Error);

    try {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await client.mutation(api.messages.upsertAssistantMessage, {
        id: uuidv4(),
        parts: [
          {
            type: "text",
            text: `I encountered an error: ${errorMessage}. Please try again.`,
          },
        ],
        metadata: {
          error: true,
          errorMessage,
          processingTime: Date.now(),
          isCompleted: true,
          workerVersion: "1.0.0",
        },
        sessionId: sessionId,
      });
    } catch (insertError) {
      logger.error("Failed to insert error message", insertError as Error);
    }
  } finally {
    streamingState.isStreamingSessionActive = false;
  }
}

async function updateAssistantMessage(
  assistantMessageId: string,
  messageChunks: Array<TextBlock | ToolUseBlock>,
  userMessageId: string | null,
  isCompleted: boolean,
) {
  try {
    const parts = JSON.parse(JSON.stringify(messageChunks));

    await client.mutation(api.messages.upsertAssistantMessage, {
      id: assistantMessageId,
      parts,
      metadata: {
        processingTime: Date.now(),
        userMessageId,
        chunkCount: messageChunks.length,
        isCompleted,
        workerVersion: "1.0.0",
      },
      sessionId: sessionId as any,
    });
  } catch (error) {
    logger.error("Failed to update assistant message", error as Error);
  }
}

async function finalizeAssistantMessage(
  assistantMessageId: string,
  messageChunks: Array<TextBlock | ToolUseBlock>,
  userMessageId: string | null,
) {
  await updateAssistantMessage(
    assistantMessageId,
    messageChunks,
    userMessageId,
    true,
  );
}

async function processUserMessage(userMessage: UserMessage | null) {
  if (!userMessage || !userMessage.parts || !Array.isArray(userMessage.parts)) {
    return;
  }

  if (streamingState.messageQueueResolver) {
    const resolver = streamingState.messageQueueResolver;
    streamingState.messageQueueResolver = null;
    resolver(userMessage);
  } else {
    streamingState.messageQueue.push(userMessage);
  }

  if (!streamingState.isStreamingSessionActive) {
    processStreamingSession().catch((error) => {
      logger.error("Streaming session failed", error as Error);
    });
  }
}

const streamingState: StreamingState = {
  hasInitialized: false,
  lastSeenMessageId: null,
  messageQueue: [],
  messageQueueResolver: null,
  isStreamingSessionActive: false,
  currentProcessingMessage: null,
  currentSessionId: null,
};

client.onUpdate(
  api.messages.getLastUserMessage,
  { sessionId },
  (userMessage) => {
    if (userMessage) {
      if (!streamingState.hasInitialized) {
        streamingState.lastSeenMessageId = userMessage.id;
        streamingState.hasInitialized = true;
        return;
      }

      if (streamingState.lastSeenMessageId === userMessage.id) {
        return;
      }

      streamingState.lastSeenMessageId = userMessage.id;
      processUserMessage(userMessage).catch((error) => {
        logger.error("Error processing message", error as Error);
      });
    } else {
      if (!streamingState.hasInitialized) {
        streamingState.hasInitialized = true;
      }
    }
  },
);

async function shutdown(signal: string): Promise<void> {
  const shutdownOp = logger.operation("shutdown", { signal });

  try {
    client.close();
    shutdownOp.success("Shutdown completed");
    process.exit(0);
  } catch (error) {
    shutdownOp.error("Shutdown failed", error as Error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

logger.info("Sandbox worker ready", { status: "listening" });
