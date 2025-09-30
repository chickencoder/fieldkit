export interface CommandResult {
  success: boolean;
  exitCode?: number;
  output?: string;
  error?: string;
  command: string;
}

export interface WorkerOptions {
  sandboxId: string;
  convexUrl: string;
  sessionId: string;
  r2Config?: R2Config;
}

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export interface WorkerStatus {
  isRunning: boolean;
  pid?: string;
}

export interface WorkerLogsResult {
  success: boolean;
  logs?: string;
  error?: string;
}

export interface DebugResult {
  success: boolean;
  debug?: string;
  error?: string;
}

export interface ServiceResult {
  success: boolean;
  error?: string;
}

export interface WorkerBundle {
  content: string;
  filename: string;
  size: number;
}

export interface WorkerEnvironment {
  CONVEX_URL: string;
  SANDBOX_ID: string;
  SESSION_ID: string;
  NODE_ENV: string;
  ANTHROPIC_API_KEY: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}