import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface WorkerBundle {
  content: string;
  filename: string;
  size: number;
}

export class WorkerBundler {
  private static bundlePath: string | null = null;
  private static cachedBundle: WorkerBundle | null = null;

  /**
   * Build the sandbox worker bundle
   */
  static async buildBundle(): Promise<WorkerBundle> {
    // If we have a cached bundle, return it
    if (this.cachedBundle) {
      console.log("📦 Using cached worker bundle");
      return this.cachedBundle;
    }

    console.log("🔨 Building sandbox worker bundle...");

    try {
      // Get the path to the sandbox-worker package
      const workerPackagePath = join(process.cwd(), "../../packages/sandbox-worker");

      if (!existsSync(workerPackagePath)) {
        throw new Error(`Sandbox worker package not found at: ${workerPackagePath}`);
      }

      // Build the standalone bundle
      const buildCommand = "pnpm build:standalone";
      console.log(`📦 Running: ${buildCommand} in ${workerPackagePath}`);

      execSync(buildCommand, {
        cwd: workerPackagePath,
        stdio: "inherit",
      });

      // Read the generated bundle
      const bundlePath = join(workerPackagePath, "dist/standalone/index.js");

      if (!existsSync(bundlePath)) {
        throw new Error(`Built bundle not found at: ${bundlePath}`);
      }

      const content = readFileSync(bundlePath, "utf-8");
      const bundle: WorkerBundle = {
        content,
        filename: "sandbox-worker.js",
        size: Buffer.byteLength(content, "utf-8"),
      };

      // Cache the bundle
      this.cachedBundle = bundle;
      this.bundlePath = bundlePath;

      console.log(`✅ Worker bundle built successfully (${(bundle.size / 1024).toFixed(1)}KB)`);
      return bundle;

    } catch (error) {
      console.error("❌ Failed to build worker bundle:", error);
      throw new Error(`Worker bundle build failed: ${error}`);
    }
  }

  /**
   * Get cached bundle or build if not available
   */
  static async getBundle(): Promise<WorkerBundle> {
    if (this.cachedBundle) {
      return this.cachedBundle;
    }
    return this.buildBundle();
  }

  /**
   * Clear cached bundle (useful for development)
   */
  static clearCache(): void {
    this.cachedBundle = null;
    this.bundlePath = null;
    console.log("🗑️ Worker bundle cache cleared");
  }

  /**
   * Check if bundle exists and is recent
   */
  static isBundleValid(): boolean {
    if (!this.bundlePath || !this.cachedBundle) {
      return false;
    }

    return existsSync(this.bundlePath);
  }

  /**
   * Generate environment variables for the worker
   */
  static generateWorkerEnv(options: {
    sandboxId: string;
    convexUrl: string;
    r2Config?: {
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucketName: string;
    };
  }): Record<string, string> {
    console.log("📋 Generating worker environment variables", {
      sandboxId: options.sandboxId,
      convexUrl: options.convexUrl?.substring(0, 50) + "...",
      hasR2Config: !!options.r2Config,
    });

    // Validate required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("⚠️ ANTHROPIC_API_KEY not found in environment - Claude Code will not work");
    }

    const env: Record<string, string> = {
      CONVEX_URL: options.convexUrl,
      SANDBOX_ID: options.sandboxId,
      NODE_ENV: "production",
      // Add Claude API key for authentication
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    };

    // Add R2 configuration if provided
    if (options.r2Config) {
      env.R2_ENDPOINT = options.r2Config.endpoint;
      env.R2_ACCESS_KEY_ID = options.r2Config.accessKeyId;
      env.R2_SECRET_ACCESS_KEY = options.r2Config.secretAccessKey;
      env.R2_BUCKET_NAME = options.r2Config.bucketName;
    }

    return env;
  }

  /**
   * Generate the command to start the worker in a sandbox
   */
  static generateStartCommand(envVars: Record<string, string>): string {
    // Convert env vars to export statements
    const envExports = Object.entries(envVars)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join(" && ");

    // Command to start worker in background with logging for debugging
    // - Set NODE_PATH to include global node_modules
    // - nohup: prevents termination when parent shell exits
    // - & puts process in background
    // - Log to /tmp/worker.log instead of /dev/null for debugging
    return `${envExports} && export NODE_PATH=$(npm root -g):$NODE_PATH && (nohup node /tmp/sandbox-worker.js >/tmp/worker.log 2>&1 & echo $! > /tmp/worker.pid && echo "Worker started with PID $(cat /tmp/worker.pid)")`;
  }

  /**
   * Generate command to stop the worker
   */
  static generateStopCommand(): string {
    return "if [ -f /tmp/worker.pid ]; then kill $(cat /tmp/worker.pid) 2>/dev/null; rm -f /tmp/worker.pid; fi";
  }

  /**
   * Generate command to check worker status
   */
  static generateStatusCommand(): string {
    return "if [ -f /tmp/worker.pid ] && kill -0 $(cat /tmp/worker.pid) 2>/dev/null; then echo 'running'; else echo 'stopped'; fi";
  }

  /**
   * Generate command to get worker logs
   */
  static generateLogsCommand(): string {
    return "if [ -f /tmp/worker.log ]; then tail -n 50 /tmp/worker.log; else echo 'No worker logs found'; fi";
  }
}