import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { WorkerBundle, WorkerEnvironment } from "./types";

export function getBundle(): WorkerBundle {
  const workerPackagePath = join(process.cwd(), "../../packages/sandbox-worker");
  const bundlePath = join(workerPackagePath, "dist/standalone/index.js");

  if (!existsSync(bundlePath)) {
    throw new Error(`Worker bundle not found at: ${bundlePath}`);
  }

  const content = readFileSync(bundlePath, "utf-8");

  return {
    content,
    filename: "sandbox-worker.js",
    size: Buffer.byteLength(content, "utf-8"),
  };
}

export function getWorkerEnv(options: {
  sandboxId: string;
  convexUrl: string;
  sessionId: string;
  r2Config?: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
}): WorkerEnvironment {
  const env: WorkerEnvironment = {
    CONVEX_URL: options.convexUrl,
    SANDBOX_ID: options.sandboxId,
    SESSION_ID: options.sessionId,
    NODE_ENV: "production",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  };

  if (options.r2Config) {
    env.R2_ENDPOINT = options.r2Config.endpoint;
    env.R2_ACCESS_KEY_ID = options.r2Config.accessKeyId;
    env.R2_SECRET_ACCESS_KEY = options.r2Config.secretAccessKey;
    env.R2_BUCKET_NAME = options.r2Config.bucketName;
  }

  return env;
}

export function getStartCommand(envVars: WorkerEnvironment): string {
  const envExports = Object.entries(envVars)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join(" && ");

  return `${envExports} && export NODE_PATH=$(npm root -g):$NODE_PATH && (nohup node /tmp/sandbox-worker.js >/tmp/worker.log 2>&1 & echo $! > /tmp/worker.pid && echo "Worker started with PID $(cat /tmp/worker.pid)")`;
}

export const STOP_COMMAND = "if [ -f /tmp/worker.pid ]; then kill $(cat /tmp/worker.pid) 2>/dev/null; rm -f /tmp/worker.pid; fi";

export const STATUS_COMMAND = "if [ -f /tmp/worker.pid ] && kill -0 $(cat /tmp/worker.pid) 2>/dev/null; then echo 'running'; else echo 'stopped'; fi";

export const LOGS_COMMAND = "if [ -f /tmp/worker.log ]; then tail -n 50 /tmp/worker.log; else echo 'No worker logs found'; fi";