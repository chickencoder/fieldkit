import chokidar from "chokidar";
import { glob } from "fast-glob";
import { readFile, stat } from "fs/promises";
import { resolve, relative } from "path";
import { createHash } from "crypto";

export interface FileChange {
  path: string;
  type: "add" | "change" | "unlink";
  hash?: string;
  size?: number;
  content?: Buffer;
}

export interface WatcherConfig {
  rootDir: string;
  ignorePaths: string[];
  immediateSync: string[]; // Patterns for files that should sync immediately
  onFileChange: (change: FileChange) => void;
  onError: (error: Error) => void;
}

export class FileWatcher {
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private config: WatcherConfig;
  private isWatching = false;

  // Default patterns for files to ignore
  private static readonly DEFAULT_IGNORE_PATTERNS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/.cache/**",
    "**/coverage/**",
    "**/.nyc_output/**",
    "**/tmp/**",
    "**/temp/**",
    "**/*.log",
    "**/.DS_Store",
    "**/Thumbs.db",
    "**/.env*",
    "**/*.tmp",
    "**/*.temp",
    "**/*.swp",
    "**/*.swo",
  ];

  // Patterns for files that should be synced immediately (critical config files)
  private static readonly DEFAULT_IMMEDIATE_PATTERNS = [
    "**/package.json",
    "**/package-lock.json",
    "**/pnpm-lock.yaml",
    "**/yarn.lock",
    "**/tsconfig.json",
    "**/tsconfig.*.json",
    "**/.env.example",
    "**/next.config.*",
    "**/vite.config.*",
    "**/webpack.config.*",
    "**/tailwind.config.*",
    "**/postcss.config.*",
    "**/.eslintrc.*",
    "**/.prettierrc.*",
    "/tmp/worker.log",
  ];

  constructor(config: WatcherConfig) {
    this.config = {
      ...config,
      ignorePaths: [
        ...FileWatcher.DEFAULT_IGNORE_PATTERNS,
        ...config.ignorePaths,
      ],
      immediateSync: [
        ...FileWatcher.DEFAULT_IMMEDIATE_PATTERNS,
        ...config.immediateSync,
      ],
    };
  }

  async start(): Promise<void> {
    if (this.isWatching) {
      console.warn("File watcher is already running");
      return;
    }

    console.log(`Starting file watcher for: ${this.config.rootDir}`);

    try {
      this.watcher = chokidar.watch(this.config.rootDir, {
        ignored: this.config.ignorePaths,
        persistent: true,
        ignoreInitial: true, // Don't trigger events for existing files
        followSymlinks: false,
        depth: 10, // Reasonable depth limit
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      this.watcher.on("add", (path: string) => this.handleFileEvent(path, "add"));
      this.watcher.on("change", (path: string) => this.handleFileEvent(path, "change"));
      this.watcher.on("unlink", (path: string) => this.handleFileEvent(path, "unlink"));

      this.watcher.on("error", (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("File watcher error:", error);
        this.config.onError(error);
      });

      this.watcher.on("ready", () => {
        console.log("File watcher ready");
        this.isWatching = true;
      });

    } catch (error) {
      console.error("Failed to start file watcher:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.watcher || !this.isWatching) {
      return;
    }

    console.log("Stopping file watcher");

    try {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      console.log("File watcher stopped");
    } catch (error) {
      console.error("Error stopping file watcher:", error);
      throw error;
    }
  }

  private async handleFileEvent(filePath: string, eventType: "add" | "change" | "unlink"): Promise<void> {
    try {
      const relativePath = relative(this.config.rootDir, filePath);

      // Skip if file matches ignore patterns
      if (this.isIgnored(relativePath)) {
        return;
      }

      console.log(`File ${eventType}: ${relativePath}`);

      const change: FileChange = {
        path: relativePath,
        type: eventType,
      };

      // For deleted files, we don't need to read content
      if (eventType === "unlink") {
        this.config.onFileChange(change);
        return;
      }

      // Read file content and calculate hash
      try {
        const content = await readFile(filePath);
        const stats = await stat(filePath);

        change.content = content;
        change.hash = this.calculateHash(content);
        change.size = stats.size;

        this.config.onFileChange(change);
      } catch (error) {
        console.error(`Failed to read file ${relativePath}:`, error);
        // Still notify about the change, even if we can't read the content
        this.config.onFileChange(change);
      }
    } catch (error) {
      console.error(`Error handling file event for ${filePath}:`, error);
      this.config.onError(error as Error);
    }
  }

  private isIgnored(filePath: string): boolean {
    // Check against ignore patterns
    for (const pattern of this.config.ignorePaths) {
      if (this.matchesPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  isImmediateSync(filePath: string): boolean {
    return this.config.immediateSync.some(pattern =>
      this.matchesPattern(filePath, pattern)
    );
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regexPattern = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  private calculateHash(content: Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  async scanExistingFiles(): Promise<FileChange[]> {
    console.log(`Scanning existing files in: ${this.config.rootDir}`);

    try {
      const files = await glob("**/*", {
        cwd: this.config.rootDir,
        ignore: this.config.ignorePaths,
        onlyFiles: true,
        followSymbolicLinks: false,
        markDirectories: false,
      });

      const changes: FileChange[] = [];

      for (const filePath of files) {
        try {
          if (!filePath) {
            console.warn("Skipping undefined file path");
            continue;
          }
          if (!this.config.rootDir) {
            throw new Error("Root directory is undefined");
          }

          const fullPath = resolve(this.config.rootDir, filePath);
          const content = await readFile(fullPath);
          const stats = await stat(fullPath);

          changes.push({
            path: filePath,
            type: "add",
            content,
            hash: this.calculateHash(content),
            size: stats.size,
          });
        } catch (error) {
          console.error(`Failed to read existing file ${filePath}:`, error);
        }
      }

      console.log(`Found ${changes.length} existing files`);
      return changes;
    } catch (error) {
      console.error("Failed to scan existing files:", error);
      throw error;
    }
  }

  isWatchingActive(): boolean {
    return this.isWatching;
  }
}