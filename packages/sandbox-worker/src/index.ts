import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { config } from "dotenv";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { TextBlock, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { v4 as uuidv4 } from "uuid";

import { FileSync } from "./sync/file-sync";
import { logger } from "./utils/logger";
import type {
  MessagePart,
  UserMessage,
  StreamingState,
} from "./types";

config();

// Environment validation
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

// Global FileSync instance
let fileSync: FileSync | null = null;

// Async generator for streaming user messages
async function* generateUserMessages() {
  logger.info("Starting message generator for streaming session");

  while (true) {
    // Wait for the next message to be available
    const message = await new Promise<UserMessage | null>((resolve) => {
      if (streamingState.messageQueue.length > 0) {
        // If we have queued messages, return the first one
        const nextMessage = streamingState.messageQueue.shift();
        resolve(nextMessage || null);
      } else {
        // Otherwise, wait for the next message to arrive
        streamingState.messageQueueResolver = resolve;
      }
    });

    if (!message) {
      logger.debug("Received null message in generator, continuing");
      continue;
    }

    logger.info("Yielding message from generator", {
      messageId: message.id,
      hasContent: !!message.parts?.length,
    });

    // Extract text content from the user message parts
    const userContent = message.parts
      ?.map((part: MessagePart) => {
        if (typeof part === "string") return part;
        return part.text || part.content || JSON.stringify(part);
      })
      .filter(Boolean)
      .join(" ");

    if (!userContent?.trim()) {
      logger.warn("No valid text content in message, skipping");
      continue;
    }

    // Store the original message for later use
    if (!streamingState.currentProcessingMessage) {
      streamingState.currentProcessingMessage = message;
    }

    // Yield the message in the format expected by Claude Code SDK
    const userMessageData = {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: userContent,
      },
      parent_tool_use_id: null,
      session_id: streamingState.currentSessionId || sandboxId,
    };

    logger.debug("About to yield user message", {
      messageId: message.id,
      contentLength: userContent.length,
    });

    yield userMessageData;
  }
}

// Process streaming session with Claude Code
async function processStreamingSession() {
  if (streamingState.isStreamingSessionActive) {
    logger.warn("Streaming session already active, skipping");
    return;
  }

  streamingState.isStreamingSessionActive = true;
  const sessionOp = logger.operation("streaming-session", {});

  try {
    // Check if there are existing messages in this sandbox session to resume
    let resumeSessionId: string | null = null;
    try {
      const currentSession = await client.query(api.sessions.getSessionById, {
        sessionId: sessionId,
      });

      if (currentSession?.agentSessionId) {
        // Only resume if we already have messages in this session
        const existingMessages = await client.query(
          api.sessions.getMessagesBySessionId,
          {
            sessionId: sessionId,
          },
        );

        if (existingMessages.length > 0) {
          resumeSessionId = currentSession.agentSessionId;
          logger.info("Found existing session to resume", {
            sessionId: resumeSessionId,
            messageCount: existingMessages.length,
          });
        }
      }
    } catch (error) {
      logger.debug("No previous session found or error getting session ID", {
        error,
      });
    }

    sessionOp.progress("Starting streaming session with Claude Code", {
      resumeSessionId,
    });

    // Create the streaming query with the message generator
    const queryOptions: Options = {
      permissionMode: "acceptEdits",
      maxTurns: 50, // Allow for long conversations
      model: "claude-sonnet-4-5-20250929", // Use a valid Claude model
      // Use Claude Code system prompt for familiar behavior
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      // Don't load filesystem settings for isolated SDK behavior
      settingSources: [],
      // Add resume option if we have a session ID
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

    // Process the streaming responses
    for await (const message of claudeQuery) {
      logger.debug("Received streaming message", { type: message.type });

      // Handle user messages from the generator
      if (message.type === "user") {
        logger.info("Processing user message in streaming session", {
          messageId: streamingState.currentProcessingMessage?.id,
        });
        currentUserMessageId =
          streamingState.currentProcessingMessage?.id || null;
        // Reset for next message
        streamingState.currentProcessingMessage = null;
        continue;
      }

      if (message.type === "assistant") {
        // Start of new assistant response
        if (currentAssistantMessageId) {
          // Complete the previous message if there was one
          await finalizeAssistantMessage(
            currentAssistantMessageId,
            currentMessageChunks,
            currentUserMessageId,
          );
        }

        // Start new assistant message
        currentAssistantMessageId = uuidv4();
        currentMessageChunks = [];

        // Get the current user message ID from metadata if available
        currentUserMessageId = null; // Will be set when we process the user message

        logger.info("Started new assistant message", {
          assistantMessageId: currentAssistantMessageId,
        });

        // Process the assistant message content
        if (message.message.content) {
          for (const contentBlock of message.message.content) {
            if (contentBlock.type === "text" || contentBlock.type === "tool_use") {
              currentMessageChunks.push(contentBlock);
            }
          }
        }

        // Update the message in the database
        await updateAssistantMessage(
          currentAssistantMessageId,
          currentMessageChunks,
          currentUserMessageId,
          false,
        );
      } else if (message.type === "stream_event") {
        // Handle streaming events
        if (
          message.event.type === "content_block_delta" &&
          message.event.delta.type === "text_delta"
        ) {
          // Accumulate text deltas - we'll update with the full content blocks
          const lastChunk = currentMessageChunks[currentMessageChunks.length - 1];
          if (lastChunk && lastChunk.type === "text") {
            lastChunk.text += message.event.delta.text;
          } else {
            currentMessageChunks.push({
              type: "text" as const,
              text: message.event.delta.text,
              citations: [],
            });
          }

          if (currentAssistantMessageId) {
            await updateAssistantMessage(
              currentAssistantMessageId,
              currentMessageChunks,
              currentUserMessageId,
              false,
            );
          }
        } else if (
          message.event.type === "content_block_start" &&
          message.event.content_block.type === "tool_use"
        ) {
          currentMessageChunks.push(message.event.content_block);

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
        logger.info("Received result message", {
          subtype: message.subtype,
          duration: message.duration_ms,
          success: message.subtype === "success",
        });

        // Finalize the current assistant message if there is one
        if (currentAssistantMessageId && currentMessageChunks.length > 0) {
          // Force a final update to catch any remaining parts
          await updateAssistantMessage(
            currentAssistantMessageId,
            currentMessageChunks,
            currentUserMessageId,
            false,
          );
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
        logger.debug("System message", { subtype: message.subtype });

        // Capture session ID from system init message
        if (message.subtype === "init" && message.session_id) {
          streamingState.currentSessionId = message.session_id;
          logger.info("Captured session ID from system init", {
            sessionId: streamingState.currentSessionId,
          });

          // Update the Convex session with the Claude session ID
          try {
            await client.mutation(api.sessions.updateSessionWithAgentId, {
              sessionId: sessionId,
              agentSessionId: message.session_id,
            });
            logger.info("Updated Convex session with Claude session ID", {
              convexSessionId: sessionId,
              claudeSessionId: message.session_id,
            });
          } catch (error) {
            logger.error(
              "Failed to update Convex session with Claude session ID",
              error as Error,
            );
          }
        }
      }
    }

    sessionOp.success("Streaming session completed");
  } catch (error) {
    sessionOp.error("Streaming session failed", error as Error);

    // Try to create an error message for the user
    try {
      const errorMessageId = uuidv4();
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred in streaming session";

      await client.mutation(api.messages.upsertAssistantMessage, {
        id: errorMessageId,
        parts: [
          {
            type: "text",
            text: `I encountered an error in our conversation: ${errorMessage}. Please try your request again.`,
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

// Helper function to update assistant message in database
async function updateAssistantMessage(
  assistantMessageId: string,
  messageChunks: Array<TextBlock | ToolUseBlock>,
  userMessageId: string | null,
  isCompleted: boolean,
) {
  try {
    logger.debug("Updating assistant message", {
      assistantMessageId: assistantMessageId.substring(0, 8),
      partsCount: messageChunks.length,
      sessionId: streamingState.currentSessionId,
      isCompleted,
    });

    await client.mutation(api.messages.upsertAssistantMessage, {
      id: assistantMessageId,
      parts: [...messageChunks], // Create a copy to avoid reference issues
      metadata: {
        processingTime: Date.now(),
        userMessageId,
        chunkCount: messageChunks.length,
        isCompleted,
        workerVersion: "1.0.0",
      },
      sessionId: sessionId as any,
    });

    logger.convex(
      isCompleted ? "Completed assistant message" : "Updated assistant message",
      {
        assistantMessageId: assistantMessageId.substring(0, 8),
        partsCount: messageChunks.length,
        isCompleted,
      },
    );
  } catch (error) {
    logger.error("Failed to update assistant message", error as Error, {
      component: "convex",
      assistantMessageId: assistantMessageId.substring(0, 8),
    });
  }
}

// Helper function to finalize assistant message
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
  logger.info("Finalized assistant message", { assistantMessageId });
}

// Legacy function kept for backward compatibility - now just queues messages
async function processUserMessage(userMessage: UserMessage | null) {
  if (!userMessage) {
    logger.warn("Received null/undefined user message, skipping processing");
    return;
  }

  logger.info("Queuing user message for streaming session", {
    messageId: userMessage.id,
    hasContent: !!userMessage.parts?.length,
  });

  // Validate user message structure
  if (!userMessage.parts || !Array.isArray(userMessage.parts)) {
    logger.error(
      "Invalid user message: missing or invalid parts array",
      new Error("Invalid message structure"),
      {
        messageId: userMessage.id,
      },
    );
    return;
  }

  // If there's a resolver waiting, resolve it directly without queuing
  if (streamingState.messageQueueResolver) {
    const resolver = streamingState.messageQueueResolver;
    streamingState.messageQueueResolver = null;
    resolver(userMessage);
  } else {
    // Otherwise, add message to queue for the streaming session
    streamingState.messageQueue.push(userMessage);
  }

  // Start streaming session if not already active
  if (!streamingState.isStreamingSessionActive) {
    logger.info("Starting new streaming session");
    processStreamingSession().catch((error) => {
      logger.error("Streaming session failed", error as Error);
    });
  }
}

// Initialize FileSync if R2 config is available
async function initializeFileSync(): Promise<void> {
  const r2Config = {
    endpoint: process.env.R2_ENDPOINT || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "",
  };

  // Check if all R2 config is provided
  if (
    !r2Config.endpoint ||
    !r2Config.accessKeyId ||
    !r2Config.secretAccessKey ||
    !r2Config.bucketName
  ) {
    logger.warn("R2 configuration incomplete, file sync disabled", {
      hasEndpoint: !!r2Config.endpoint,
      hasAccessKey: !!r2Config.accessKeyId,
      hasSecretKey: !!r2Config.secretAccessKey,
      hasBucket: !!r2Config.bucketName,
    });
    return;
  }

  const rootDir = process.cwd();

  try {
    const fsOp = logger.operation("initialize-file-sync", {
      sandboxId,
      rootDir,
    });

    fileSync = new FileSync({
      sandboxId,
      rootDir,
      r2Config,
      onSyncComplete: (file, success) => {
        logger.fileSync(`File sync ${success ? "completed" : "failed"}`, {
          file,
          success,
        });
      },
      onError: (error, context) => {
        logger.error("File sync error", error, {
          component: "file-sync",
          context,
        });
      },
    });

    await fileSync?.initialize();
    await fileSync?.start();

    fsOp.success("File sync started");
  } catch (error) {
    logger.error("Failed to initialize file sync", error as Error);
    fileSync = null;
  }
}

// Track processing state and message queue for streaming
const streamingState: StreamingState = {
  hasInitialized: false,
  lastSeenMessageId: null,
  messageQueue: [],
  messageQueueResolver: null,
  isStreamingSessionActive: false,
  currentProcessingMessage: null,
  currentSessionId: null,
};

// Initialize file sync
initializeFileSync().catch((error) => {
  logger.error("Failed to initialize file sync on startup", error as Error);
});

client.onUpdate(api.messages.getLastUserMessage, {}, (userMessage) => {
  if (userMessage) {
    logger.convex("Received user message", { messageId: userMessage.id });

    // On first subscription fire, just record the current message without processing
    if (!streamingState.hasInitialized) {
      streamingState.lastSeenMessageId = userMessage.id;
      streamingState.hasInitialized = true;
      logger.info("Initialized with existing message", {
        messageId: userMessage.id,
      });
      return;
    }

    // Only process if this is a new message we haven't seen before
    if (streamingState.lastSeenMessageId === userMessage.id) {
      logger.debug("Already seen message, skipping", {
        messageId: userMessage.id,
      });
      return;
    }

    // Update last seen message
    streamingState.lastSeenMessageId = userMessage.id;

    // Process message (which will queue it for streaming session)
    processUserMessageSafely(userMessage);
  } else {
    if (!streamingState.hasInitialized) {
      streamingState.hasInitialized = true;
      logger.info("Initialized with no pending messages");
    }
  }
});

async function processUserMessageSafely(userMessage: UserMessage) {
  try {
    await processUserMessage(userMessage);
  } catch (error) {
    logger.error("Unhandled error in message processing", error as Error);
  }
}

// Function to reset session (useful for testing or when starting fresh)
function resetSession() {
  logger.info("Resetting session state");
  streamingState.currentSessionId = null;
  streamingState.messageQueue = [];
  streamingState.messageQueueResolver = null;
  streamingState.currentProcessingMessage = null;

  if (streamingState.isStreamingSessionActive) {
    logger.warn("Session reset requested while streaming session is active");
  }
}

// Graceful shutdown handling
async function shutdown(signal: string): Promise<void> {
  const shutdownOp = logger.operation("shutdown", { signal });

  try {
    // Stop file sync if running
    if (fileSync) {
      shutdownOp.progress("Stopping file sync");
      await fileSync.stop();
    }

    // Close Convex client
    shutdownOp.progress("Closing Convex client");
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
