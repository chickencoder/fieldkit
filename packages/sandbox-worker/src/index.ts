import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import { config } from "dotenv";
import { query } from "@anthropic-ai/claude-code";
import { v4 as uuidv4 } from "uuid";
import { FileSync } from "./sync/file-sync";

config();

const client = new ConvexClient(process.env.CONVEX_URL!);

// Global FileSync instance
let fileSync: FileSync | null = null;

async function processUserMessage(userMessage: any) {
  if (!userMessage) {
    console.warn("Received null/undefined user message, skipping processing");
    return;
  }

  console.log(
    `🚀 Processing user message: ${userMessage.id} (created at: ${new Date(userMessage._creationTime).toISOString()})`,
  );

  const startTime = Date.now();

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

    console.log(
      `📝 User content (${userContent.length} chars): ${userContent.substring(0, 100)}${userContent.length > 100 ? "..." : ""}`,
    );

    // Query Claude Code with the user message
    console.log("🤖 Querying Claude Code...");
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
    console.log(`🆔 Generated assistant message ID: ${assistantMessageId}`);

    // Function to update the message in the database
    const updateMessage = async (isCompleted = false) => {
      const processingDuration = Date.now() - startTime;

      try {
        await client.mutation(api.messages.upsertAssistantMessage, {
          id: assistantMessageId,
          parts: [...messageChunks], // Create a copy to avoid reference issues
          metadata: {
            processingTime: Date.now(),
            processingDurationMs: processingDuration,
            userMessageId: userMessage.id,
            chunkCount,
            isCompleted,
            workerVersion: "1.0.0",
          },
        });

        console.log(
          `💾 ${isCompleted ? "Final" : "Streaming"} update: ${messageChunks.length} parts (${processingDuration}ms)`,
        );
      } catch (error) {
        console.error("❌ Failed to update message:", error);
      }
    };

    // Stream Claude's response
    for await (const message of claudeQuery) {
      chunkCount++;
      console.log(`📨 Received chunk ${chunkCount}: ${message.type}`);

      let shouldUpdate = false;

      if (message.type === "assistant") {
        console.log(`🤖 Assistant message received`);
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
              console.log(`🔧 Tool use: ${contentBlock.name}`);
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
        console.log(`🌊 Stream event: ${message.event.type}`);
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
          console.log(`🔧 Tool use start: ${message.event.content_block.name}`);
          messageChunks.push({
            type: "tool_use",
            name: message.event.content_block.name,
            input: message.event.content_block.input,
            id: message.event.content_block.id,
          });
          shouldUpdate = true;
        }
      } else if (message.type === "result") {
        console.log(`📊 Result: ${message.subtype} (${message.duration_ms}ms)`);
        if (message.subtype !== "success") {
          console.log(`⚠️ Non-success result: ${message.subtype}`);
        }
      } else if (message.type === "system") {
        console.log(`⚙️ System message: ${message.subtype}`);
      } else {
        console.log(`❓ Unknown message type: ${message.type}`);
      }

      // Update the database with new chunks
      if (shouldUpdate) {
        await updateMessage(false);
      }
    }

    console.log(
      `✅ Claude Code query completed. Received ${chunkCount} chunks, ${messageChunks.length} message parts`,
    );

    // Final update to mark as completed
    if (messageChunks.length > 0) {
      await updateMessage(true);
      console.log(
        `✅ Successfully completed assistant message: ${assistantMessageId}`,
      );
    } else {
      console.warn("⚠️ No message chunks received from Claude Code");
    }
  } catch (error) {
    const processingDuration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(
      `❌ Error processing user message ${userMessage.id}:`,
      errorMessage,
    );
    if (errorStack) {
      console.error("Stack trace:", errorStack);
    }

    try {
      // Insert error message
      const errorMessageId = uuidv4();
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
          processingDurationMs: processingDuration,
          userMessageId: userMessage.id,
          isCompleted: true,
          workerVersion: "1.0.0",
        },
      });

      console.log(`💾 Inserted error message: ${errorMessageId}`);
    } catch (insertError) {
      console.error("❌ Failed to insert error message:", insertError);
    }
  }
}

// Environment validation
if (!process.env.CONVEX_URL) {
  console.error("❌ CONVEX_URL environment variable is required");
  process.exit(1);
}

// Initialize FileSync if R2 config is available
async function initializeFileSync(): Promise<void> {
  const r2Config = {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
  };

  // Check if all R2 config is provided
  if (!r2Config.endpoint || !r2Config.accessKeyId || !r2Config.secretAccessKey || !r2Config.bucketName) {
    console.log("⚠️ R2 configuration not complete, file sync disabled");
    console.log("Required env vars: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
    return;
  }

  const sandboxId = process.env.SANDBOX_ID || `sandbox-${Date.now()}`;
  const rootDir = process.cwd();

  try {
    console.log("🔄 Initializing file sync...");

    fileSync = new FileSync({
      sandboxId,
      rootDir,
      r2Config,
      onSyncComplete: (file, success) => {
        console.log(`📁 Sync ${success ? "completed" : "failed"}: ${file}`);
      },
      onError: (error, context) => {
        console.error(`❌ File sync error${context ? ` (${context})` : ""}:`, error);
      },
    });

    await fileSync.initialize();
    await fileSync.start();

    console.log("✅ File sync initialized and started");
  } catch (error) {
    console.error("❌ Failed to initialize file sync:", error);
    fileSync = null;
  }
}

console.log("🏁 Starting sandbox worker...");
console.log(`📡 Connecting to Convex: ${process.env.CONVEX_URL}`);

// Initialize file sync
initializeFileSync().catch(error => {
  console.error("❌ Failed to initialize file sync on startup:", error);
});

// Track processing state to prevent concurrent processing
let isProcessing = false;
let hasInitialized = false;
let lastSeenMessageId: string | null = null;

client.onUpdate(api.messages.getLastUserMessage, {}, (userMessage) => {
  if (userMessage) {
    console.log(`📬 Received user message: ${userMessage.id}`);

    // On first subscription fire, just record the current message without processing
    if (!hasInitialized) {
      lastSeenMessageId = userMessage.id;
      hasInitialized = true;
      console.log(
        `🏁 Initialized with existing message: ${userMessage.id} (not processing)`,
      );
      return;
    }

    // Only process if this is a new message we haven't seen before
    if (lastSeenMessageId === userMessage.id) {
      console.log(`⏭️ Already seen message: ${userMessage.id} (skipping)`);
      return;
    }

    // Update last seen message
    lastSeenMessageId = userMessage.id;

    if (isProcessing) {
      console.log("⏳ Already processing a message, queuing this one...");
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
    console.log("📭 No unprocessed user messages");
    if (!hasInitialized) {
      hasInitialized = true;
      console.log("🏁 Initialized with no pending messages");
    }
  }
});

async function processUserMessageSafely(userMessage: any) {
  if (isProcessing) {
    console.log("⏳ Still processing previous message, skipping");
    return;
  }

  isProcessing = true;
  try {
    await processUserMessage(userMessage);
  } catch (error) {
    console.error("❌ Unhandled error in message processing:", error);
  } finally {
    isProcessing = false;
    console.log("✅ Ready for next message");
  }
}

// Graceful shutdown handling
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  try {
    // Stop file sync if running
    if (fileSync) {
      console.log("🔄 Stopping file sync...");
      await fileSync.stop();
      console.log("✅ File sync stopped");
    }

    // Close Convex client
    client.close();
    console.log("✅ Convex client closed");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("✅ Sandbox worker is running and listening for messages...");
