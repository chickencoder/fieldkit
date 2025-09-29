import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import { config } from "dotenv";
import { query } from "@anthropic-ai/claude-code";
import { v4 as uuidv4 } from "uuid";
import { FileSync } from "./sync/file-sync";
import { logger } from "./utils/logger";

config();

// Environment validation
if (!process.env.CONVEX_URL) {
  logger.error("CONVEX_URL environment variable is required");
  process.exit(1);
}

logger.info("Starting sandbox worker", {
  nodeVersion: process.version,
  platform: process.platform,
  cwd: process.cwd(),
  convexUrl: process.env.CONVEX_URL?.substring(0, 50) + "...",
  sandboxId: process.env.SANDBOX_ID,
});

const client = new ConvexClient(process.env.CONVEX_URL!);
const sandboxId = process.env.SANDBOX_ID || `sandbox-${Date.now()}`;

// Global FileSync instance
let fileSync: FileSync | null = null;

async function processUserMessage(userMessage: any) {
  if (!userMessage) {
    logger.warn("Received null/undefined user message, skipping processing");
    return;
  }

  logger.info("Processing user message", {
    messageId: userMessage.id,
    messageType: typeof userMessage,
    hasId: !!userMessage.id,
    hasParts: !!userMessage.parts,
    partsLength: userMessage.parts?.length,
  });

  const op = logger.operation("process-user-message", {
    messageId: userMessage.id,
    createdAt: userMessage._creationTime,
  });

  try {
    // Validate user message structure
    if (!userMessage.parts || !Array.isArray(userMessage.parts)) {
      throw new Error("Invalid user message: missing or invalid parts array");
    }

    // Extract text content from the user message parts
    const userContent = userMessage.parts
      .map((part: any) => {
        if (typeof part === "string") return part;
        return part.text || part.content || JSON.stringify(part);
      })
      .filter(Boolean)
      .join(" ");

    if (!userContent.trim()) {
      throw new Error("No valid text content found in user message");
    }

    op.progress("Extracted user content", {
      contentLength: userContent.length,
      preview: userContent.substring(0, 100),
    });

    // Query Claude Code with the user message
    logger.claude("Starting Claude Code query", {
      contentLength: userContent.length,
    });
    const claudeQuery = query({
      prompt: userContent,
      options: {
        permissionMode: "acceptEdits",
      },
    });

    let messageChunks: any[] = [];
    let chunkCount = 0;

    // Generate assistant message ID upfront for streaming
    const assistantMessageId = uuidv4();
    logger.convex("Generated assistant message ID", { assistantMessageId });

    // Function to update the message in the database
    const updateMessage = async (isCompleted = false) => {
      try {
        await client.mutation(api.messages.upsertAssistantMessage, {
          id: assistantMessageId,
          parts: [...messageChunks], // Create a copy to avoid reference issues
          metadata: {
            processingTime: Date.now(),
            userMessageId: userMessage.id,
            chunkCount,
            isCompleted,
            workerVersion: "1.0.0",
          },
        });

        logger.convex(
          isCompleted ? "Final message update" : "Streaming update",
          {
            partsCount: messageChunks.length,
            chunkCount,
            isCompleted,
          },
        );
      } catch (error) {
        logger.error("Failed to update message", error as Error, {
          component: "convex",
        });
      }
    };

    // Stream Claude's response
    for await (const message of claudeQuery) {
      chunkCount++;
      logger.debug("Received Claude chunk", { chunkCount, type: message.type });

      let shouldUpdate = false;

      if (message.type === "assistant") {
        logger.debug("Assistant message received");
        // Extract content from the API assistant message
        if (message.message.content) {
          for (const contentBlock of message.message.content) {
            if (contentBlock.type === "text") {
              messageChunks.push({
                type: "text",
                text: contentBlock.text,
              });
              shouldUpdate = true;
            } else if (contentBlock.type === "tool_use") {
              logger.debug("Tool use detected", {
                toolName: contentBlock.name,
              });
              messageChunks.push({
                type: "tool_use",
                name: contentBlock.name,
                input: contentBlock.input,
                id: contentBlock.id,
              });
              shouldUpdate = true;
            }
          }
        }
      } else if (message.type === "stream_event") {
        logger.debug("Stream event", { eventType: message.event.type });
        // Handle partial assistant messages during streaming
        if (
          message.event.type === "content_block_delta" &&
          message.event.delta.type === "text_delta"
        ) {
          messageChunks.push({
            type: "text",
            text: message.event.delta.text,
          });
          shouldUpdate = true;
        } else if (
          message.event.type === "content_block_start" &&
          message.event.content_block.type === "tool_use"
        ) {
          logger.debug("Tool use start", {
            toolName: message.event.content_block.name,
          });
          messageChunks.push({
            type: "tool_use",
            name: message.event.content_block.name,
            input: message.event.content_block.input,
            id: message.event.content_block.id,
          });
          shouldUpdate = true;
        }
      } else if (message.type === "result") {
        const isSuccess = message.subtype === "success";
        logger.info("Claude query result", {
          subtype: message.subtype,
          duration: message.duration_ms,
          success: isSuccess,
        });
      } else if (message.type === "system") {
        logger.debug("System message", { subtype: message.subtype });
      } else {
        logger.debug("Unknown message type", { type: message.type });
      }

      // Update the database with new chunks
      if (shouldUpdate) {
        await updateMessage(false);
      }
    }

    op.success("Claude Code query completed", {
      chunkCount,
      partsCount: messageChunks.length,
    });

    // Final update to mark as completed
    if (messageChunks.length > 0) {
      await updateMessage(true);
      logger.convex("Assistant message completed", { assistantMessageId });
    } else {
      logger.warn("No message chunks received from Claude Code");
    }
  } catch (error) {
    op.error("Failed to process user message", error as Error, {
      messageId: userMessage.id,
    });

    try {
      // Insert error message
      const errorMessageId = uuidv4();
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      await client.mutation(api.messages.upsertAssistantMessage, {
        id: errorMessageId,
        parts: [
          {
            type: "text",
            text: `I encountered an error while processing your request: ${errorMessage}`,
          },
        ],
        metadata: {
          error: true,
          errorMessage,
          errorStack,
          processingTime: Date.now(),
          userMessageId: userMessage.id,
          isCompleted: true,
          workerVersion: "1.0.0",
        },
      });

      logger.convex("Inserted error message", { errorMessageId });
    } catch (insertError) {
      logger.error("Failed to insert error message", insertError as Error, {
        component: "convex",
      });
    }
  }
}

// Environment validation
if (!process.env.CONVEX_URL) {
  logger.error("CONVEX_URL environment variable is required");
  process.exit(1);
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

// Initialize file sync
initializeFileSync().catch((error) => {
  logger.error("Failed to initialize file sync on startup", error as Error);
});

// Track processing state to prevent concurrent processing
let isProcessing = false;
let hasInitialized = false;
let lastSeenMessageId: string | null = null;

client.onUpdate(api.messages.getLastUserMessage, {}, (userMessage) => {
  if (userMessage) {
    logger.convex("Received user message", { messageId: userMessage.id });

    // On first subscription fire, just record the current message without processing
    if (!hasInitialized) {
      lastSeenMessageId = userMessage.id;
      hasInitialized = true;
      logger.info("Initialized with existing message", {
        messageId: userMessage.id,
      });
      return;
    }

    // Only process if this is a new message we haven't seen before
    if (lastSeenMessageId === userMessage.id) {
      logger.debug("Already seen message, skipping", {
        messageId: userMessage.id,
      });
      return;
    }

    // Update last seen message
    lastSeenMessageId = userMessage.id;

    if (isProcessing) {
      logger.warn("Already processing a message, queuing this one");
      // In a production system, you might want to implement a proper queue
      setTimeout(() => {
        if (!isProcessing) {
          processUserMessageSafely(userMessage);
        }
      }, 1000);
    } else {
      processUserMessageSafely(userMessage);
    }
  } else {
    if (!hasInitialized) {
      hasInitialized = true;
      logger.info("Initialized with no pending messages");
    }
  }
});

async function processUserMessageSafely(userMessage: any) {
  if (isProcessing) {
    logger.warn("Still processing previous message, skipping");
    return;
  }

  isProcessing = true;
  try {
    await processUserMessage(userMessage);
  } catch (error) {
    logger.error("Unhandled error in message processing", error as Error);
  } finally {
    isProcessing = false;
    logger.debug("Ready for next message");
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
