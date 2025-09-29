import { R2Client } from "./r2-client";
import { FileChange } from "./file-watcher";

export interface QueuedFile {
  change: FileChange;
  priority: "immediate" | "batch";
  retryCount: number;
  addedAt: Date;
}

export interface SyncQueueConfig {
  r2Client: R2Client;
  sandboxId: string;
  batchSize: number;
  batchInterval: number; // milliseconds
  maxRetries: number;
  onSync: (file: QueuedFile, success: boolean) => void;
  onError: (error: Error, file?: QueuedFile) => void;
}

export class SyncQueue {
  private config: SyncQueueConfig;
  private queue: QueuedFile[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isStopped = false;

  constructor(config: SyncQueueConfig) {
    this.config = config;
  }

  async addFile(change: FileChange, priority: "immediate" | "batch" = "batch"): Promise<void> {
    if (this.isStopped) {
      console.warn(`⚠️ Sync queue is stopped, ignoring file: ${change.path}`);
      return;
    }

    // Remove any existing entry for the same file
    this.queue = this.queue.filter(item => item.change.path !== change.path);

    const queuedFile: QueuedFile = {
      change,
      priority,
      retryCount: 0,
      addedAt: new Date(),
    };

    this.queue.push(queuedFile);

    console.log(`📝 Queued file: ${change.path} (${priority} priority, queue size: ${this.queue.length})`);

    if (priority === "immediate") {
      // Process immediate files right away
      await this.processImmediateFiles();
    } else {
      // Schedule batch processing if not already scheduled
      this.scheduleBatchProcessing();
    }
  }

  private async processImmediateFiles(): Promise<void> {
    const immediateFiles = this.queue.filter(item => item.priority === "immediate");

    if (immediateFiles.length === 0) {
      return;
    }

    console.log(`⚡ Processing ${immediateFiles.length} immediate files`);

    // Remove immediate files from queue before processing
    this.queue = this.queue.filter(item => item.priority !== "immediate");

    // Process immediate files in parallel (with reasonable concurrency)
    const concurrency = Math.min(immediateFiles.length, 5);
    const chunks = this.chunkArray(immediateFiles, concurrency);

    for (const chunk of chunks) {
      await Promise.all(chunk.map(file => this.syncFile(file)));
    }
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimer || this.isProcessing) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.processBatchFiles();
    }, this.config.batchInterval);
  }

  private async processBatchFiles(): Promise<void> {
    if (this.isProcessing || this.isStopped) {
      return;
    }

    this.batchTimer = null;
    this.isProcessing = true;

    try {
      const batchFiles = this.queue
        .filter(item => item.priority === "batch")
        .slice(0, this.config.batchSize);

      if (batchFiles.length === 0) {
        return;
      }

      console.log(`📦 Processing batch of ${batchFiles.length} files`);

      // Remove batch files from queue before processing
      this.queue = this.queue.filter(item =>
        item.priority !== "batch" || !batchFiles.includes(item)
      );

      // Process batch files with limited concurrency
      const concurrency = Math.min(batchFiles.length, 3);
      const chunks = this.chunkArray(batchFiles, concurrency);

      for (const chunk of chunks) {
        await Promise.all(chunk.map(file => this.syncFile(file)));
      }

      // If there are still batch files in queue, schedule next batch
      if (this.queue.some(item => item.priority === "batch")) {
        this.scheduleBatchProcessing();
      }

    } finally {
      this.isProcessing = false;
    }
  }

  private async syncFile(queuedFile: QueuedFile): Promise<void> {
    const { change } = queuedFile;

    try {
      if (change.type === "unlink") {
        // Delete file from R2
        await this.config.r2Client.deleteFile(this.config.sandboxId, change.path);
      } else {
        // Upload/update file in R2
        if (!change.content) {
          throw new Error(`No content available for file: ${change.path}`);
        }

        await this.config.r2Client.uploadFile(
          this.config.sandboxId,
          change.path,
          change.content
        );
      }

      this.config.onSync(queuedFile, true);

    } catch (error) {
      console.error(`❌ Failed to sync file ${change.path}:`, error);

      // Retry logic
      if (queuedFile.retryCount < this.config.maxRetries) {
        queuedFile.retryCount++;
        console.log(`🔄 Retrying sync for ${change.path} (attempt ${queuedFile.retryCount}/${this.config.maxRetries})`);

        // Add back to queue with exponential backoff
        setTimeout(() => {
          if (!this.isStopped) {
            this.queue.push(queuedFile);
            if (queuedFile.priority === "immediate") {
              this.processImmediateFiles();
            } else {
              this.scheduleBatchProcessing();
            }
          }
        }, Math.pow(2, queuedFile.retryCount) * 1000); // 2s, 4s, 8s...

      } else {
        console.error(`💀 Max retries exceeded for file: ${change.path}`);
        this.config.onSync(queuedFile, false);
        this.config.onError(error as Error, queuedFile);
      }
    }
  }

  async flush(): Promise<void> {
    console.log(`🚿 Flushing sync queue (${this.queue.length} files)`);

    // Clear any pending batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Process all remaining files
    while (this.queue.length > 0 && !this.isStopped) {
      await this.processImmediateFiles();
      await this.processBatchFiles();
    }

    console.log("✅ Sync queue flushed");
  }

  stop(): void {
    console.log("🛑 Stopping sync queue");

    this.isStopped = true;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.queue = [];
    console.log("✅ Sync queue stopped");
  }

  start(): void {
    console.log("▶️ Starting sync queue");
    this.isStopped = false;

    // If there are queued files, schedule processing
    if (this.queue.length > 0) {
      this.processImmediateFiles();
      this.scheduleBatchProcessing();
    }
  }

  getQueueStatus(): {
    totalFiles: number;
    immediateFiles: number;
    batchFiles: number;
    isProcessing: boolean;
    isStopped: boolean;
  } {
    const immediateFiles = this.queue.filter(item => item.priority === "immediate").length;
    const batchFiles = this.queue.filter(item => item.priority === "batch").length;

    return {
      totalFiles: this.queue.length,
      immediateFiles,
      batchFiles,
      isProcessing: this.isProcessing,
      isStopped: this.isStopped,
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}