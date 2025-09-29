import { R2Client, R2Config, SyncFile } from "./r2-client";
import { FileWatcher, FileChange, WatcherConfig } from "./file-watcher";
import { SyncQueue, QueuedFile, SyncQueueConfig } from "./sync-queue";
import { readFile, writeFile, mkdir, rmdir } from "fs/promises";
import { dirname, join } from "path";
import { existsSync } from "fs";

export interface FileSyncConfig {
  sandboxId: string;
  rootDir: string;
  r2Config: R2Config;
  batchSize?: number;
  batchInterval?: number;
  maxRetries?: number;
  ignorePaths?: string[];
  immediateSync?: string[];
  onSyncComplete?: (file: string, success: boolean) => void;
  onError?: (error: Error, context?: string) => void;
}

export interface SyncStats {
  totalFiles: number;
  syncedFiles: number;
  failedFiles: number;
  queuedFiles: number;
  lastSyncTime?: Date;
}

export class FileSync {
  private config: FileSyncConfig;
  private r2Client: R2Client;
  private fileWatcher: FileWatcher;
  private syncQueue: SyncQueue;
  private stats: SyncStats;
  private isInitialized = false;
  private isRunning = false;

  constructor(config: FileSyncConfig) {
    this.config = {
      batchSize: 10,
      batchInterval: 30000, // 30 seconds
      maxRetries: 3,
      ignorePaths: [],
      immediateSync: [],
      ...config,
    };

    this.stats = {
      totalFiles: 0,
      syncedFiles: 0,
      failedFiles: 0,
      queuedFiles: 0,
    };

    this.r2Client = new R2Client(this.config.r2Config);

    this.fileWatcher = new FileWatcher({
      rootDir: this.config.rootDir,
      ignorePaths: this.config.ignorePaths || [],
      immediateSync: this.config.immediateSync || [],
      onFileChange: this.handleFileChange.bind(this),
      onError: this.handleError.bind(this),
    });

    this.syncQueue = new SyncQueue({
      r2Client: this.r2Client,
      sandboxId: this.config.sandboxId,
      batchSize: this.config.batchSize!,
      batchInterval: this.config.batchInterval!,
      maxRetries: this.config.maxRetries!,
      onSync: this.handleSyncResult.bind(this),
      onError: this.handleSyncError.bind(this),
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("⚠️ FileSync is already initialized");
      return;
    }

    console.log(`🚀 Initializing FileSync for sandbox: ${this.config.sandboxId}`);

    try {
      // Check if we have any existing files in R2 to restore
      await this.restoreFromR2();

      // Scan existing files and sync if needed
      await this.performInitialSync();

      this.isInitialized = true;
      console.log("✅ FileSync initialized successfully");

    } catch (error) {
      console.error("❌ Failed to initialize FileSync:", error);
      this.handleError(error as Error, "FileSync initialization");
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("FileSync must be initialized before starting");
    }

    if (this.isRunning) {
      console.warn("⚠️ FileSync is already running");
      return;
    }

    console.log("▶️ Starting FileSync");

    try {
      this.syncQueue.start();
      await this.fileWatcher.start();
      this.isRunning = true;

      console.log("✅ FileSync started successfully");
    } catch (error) {
      console.error("❌ Failed to start FileSync:", error);
      this.handleError(error as Error, "FileSync start");
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn("⚠️ FileSync is not running");
      return;
    }

    console.log("🛑 Stopping FileSync");

    try {
      // Stop watching for new changes
      await this.fileWatcher.stop();

      // Flush any remaining files in the queue
      await this.syncQueue.flush();

      // Stop the sync queue
      this.syncQueue.stop();

      this.isRunning = false;
      console.log("✅ FileSync stopped successfully");

    } catch (error) {
      console.error("❌ Error stopping FileSync:", error);
      this.handleError(error as Error, "FileSync stop");
      throw error;
    }
  }

  private async restoreFromR2(): Promise<void> {
    console.log("📥 Checking for files to restore from R2");

    try {
      const remoteFiles = await this.r2Client.listFiles(this.config.sandboxId);

      if (remoteFiles.length === 0) {
        console.log("📂 No files found in R2 to restore");
        return;
      }

      console.log(`📥 Found ${remoteFiles.length} files in R2, starting restore`);

      let restoredCount = 0;
      const errors: string[] = [];

      // Restore files with limited concurrency
      const concurrency = 5;
      for (let i = 0; i < remoteFiles.length; i += concurrency) {
        const batch = remoteFiles.slice(i, i + concurrency);

        await Promise.all(
          batch.map(async (file) => {
            try {
              await this.restoreFile(file);
              restoredCount++;
            } catch (error) {
              const errorMsg = `Failed to restore ${file.path}: ${error}`;
              errors.push(errorMsg);
              console.error(`❌ ${errorMsg}`);
            }
          })
        );
      }

      console.log(`✅ Restored ${restoredCount}/${remoteFiles.length} files from R2`);

      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} files failed to restore`);
      }

      // Run npm install if package.json was restored
      if (remoteFiles.some(f => f.path === "package.json")) {
        await this.runPackageInstall();
      }

    } catch (error) {
      console.error("❌ Failed to restore files from R2:", error);
      this.handleError(error as Error, "R2 restore");
    }
  }

  private async restoreFile(file: SyncFile): Promise<void> {
    const localPath = join(this.config.rootDir, file.path);

    // Check if local file exists and is the same
    if (existsSync(localPath)) {
      try {
        const localContent = await readFile(localPath);
        const localHash = this.r2Client.calculateHash(localContent);

        if (localHash === file.hash) {
          console.log(`⏭️ Skipping ${file.path} (already up to date)`);
          return;
        }
      } catch (error) {
        console.warn(`⚠️ Could not read local file ${file.path}, will restore from R2`);
      }
    }

    // Download and restore file
    const content = await this.r2Client.downloadFile(this.config.sandboxId, file.path);

    if (!content) {
      throw new Error(`No content received for file: ${file.path}`);
    }

    // Ensure directory exists
    const dir = dirname(localPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(localPath, content);
    console.log(`📥 Restored: ${file.path} (${content.length} bytes)`);
  }

  private async performInitialSync(): Promise<void> {
    console.log("🔍 Performing initial sync scan");

    try {
      const localFiles = await this.fileWatcher.scanExistingFiles();
      const remoteFiles = await this.r2Client.listFiles(this.config.sandboxId);

      // Create maps for efficient lookup
      const localFileMap = new Map(localFiles.map(f => [f.path, f]));
      const remoteFileMap = new Map(remoteFiles.map(f => [f.path, f]));

      const filesToSync: FileChange[] = [];

      // Check for files that need to be uploaded (new or changed)
      for (const localFile of localFiles) {
        const remoteFile = remoteFileMap.get(localFile.path);

        if (!remoteFile || remoteFile.hash !== localFile.hash) {
          filesToSync.push(localFile);
        }
      }

      // Check for files that need to be deleted from R2
      for (const remoteFile of remoteFiles) {
        if (!localFileMap.has(remoteFile.path)) {
          filesToSync.push({
            path: remoteFile.path,
            type: "unlink",
          });
        }
      }

      if (filesToSync.length === 0) {
        console.log("✅ All files are in sync");
        return;
      }

      console.log(`📤 Syncing ${filesToSync.length} files`);

      // Queue files for sync
      for (const file of filesToSync) {
        const priority = this.fileWatcher.isImmediateSync(file.path) ? "immediate" : "batch";
        await this.syncQueue.addFile(file, priority);
      }

      this.stats.totalFiles = localFiles.length;

    } catch (error) {
      console.error("❌ Failed to perform initial sync:", error);
      this.handleError(error as Error, "Initial sync");
      throw error;
    }
  }

  private async runPackageInstall(): Promise<void> {
    console.log("📦 Running package installation");

    try {
      // Determine which package manager to use
      const packageManager = this.detectPackageManager();

      console.log(`📦 Installing packages using ${packageManager}`);

      // This would typically be done by the main worker or external process
      // For now, we just log the intent
      console.log(`💡 Would run: ${packageManager} install`);

      // In a real implementation, you might:
      // - Send a message to the main worker to run the install
      // - Use child_process to run the command
      // - Or let the user/system handle this separately

    } catch (error) {
      console.error("❌ Failed to run package installation:", error);
      this.handleError(error as Error, "Package installation");
    }
  }

  private detectPackageManager(): string {
    const lockFiles = {
      "pnpm-lock.yaml": "pnpm",
      "yarn.lock": "yarn",
      "package-lock.json": "npm",
    };

    for (const [lockFile, pm] of Object.entries(lockFiles)) {
      if (existsSync(join(this.config.rootDir, lockFile))) {
        return pm;
      }
    }

    return "npm"; // default
  }

  private handleFileChange(change: FileChange): void {
    console.log(`📝 File change detected: ${change.path} (${change.type})`);

    const priority = this.fileWatcher.isImmediateSync(change.path) ? "immediate" : "batch";

    this.syncQueue.addFile(change, priority).catch(error => {
      console.error(`❌ Failed to queue file ${change.path}:`, error);
      this.handleError(error as Error, `Queueing file: ${change.path}`);
    });

    this.stats.queuedFiles++;
  }

  private handleSyncResult(file: QueuedFile, success: boolean): void {
    if (success) {
      this.stats.syncedFiles++;
      console.log(`✅ Synced: ${file.change.path}`);
    } else {
      this.stats.failedFiles++;
      console.error(`❌ Failed to sync: ${file.change.path}`);
    }

    this.stats.lastSyncTime = new Date();
    this.stats.queuedFiles = Math.max(0, this.stats.queuedFiles - 1);

    // Notify callback if provided
    if (this.config.onSyncComplete) {
      this.config.onSyncComplete(file.change.path, success);
    }
  }

  private handleSyncError(error: Error, file?: QueuedFile): void {
    const context = file ? `Syncing file: ${file.change.path}` : "Sync operation";
    console.error(`❌ Sync error (${context}):`, error);
    this.handleError(error, context);
  }

  private handleError(error: Error, context?: string): void {
    if (this.config.onError) {
      this.config.onError(error, context);
    }
  }

  getStats(): SyncStats {
    const queueStatus = this.syncQueue.getQueueStatus();
    return {
      ...this.stats,
      queuedFiles: queueStatus.totalFiles,
    };
  }

  async cleanup(): Promise<void> {
    console.log(`🧹 Cleaning up FileSync for sandbox: ${this.config.sandboxId}`);

    try {
      // Stop sync operations
      if (this.isRunning) {
        await this.stop();
      }

      // Optionally clean up R2 files
      // await this.r2Client.cleanup(this.config.sandboxId);

      console.log("✅ FileSync cleanup completed");
    } catch (error) {
      console.error("❌ Error during FileSync cleanup:", error);
      throw error;
    }
  }

  isActive(): boolean {
    return this.isRunning && this.fileWatcher.isWatchingActive();
  }
}