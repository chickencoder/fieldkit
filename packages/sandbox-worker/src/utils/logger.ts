import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  sandboxId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  fileCount?: number;
  [key: string]: unknown;
}

class Logger {
  private sandboxId: string;
  private logFile: string;

  constructor(sandboxId?: string) {
    this.sandboxId = sandboxId || process.env.SANDBOX_ID || "unknown";

    // Validate sandboxId
    if (!this.sandboxId || this.sandboxId === "undefined") {
      this.sandboxId = `fallback-${Date.now()}`;
    }

    // Create logs directory and file
    const logsDir = "/tmp/sandbox-logs";
    try {
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      this.logFile = join(logsDir, `${this.sandboxId}.log`);

      // Initialize log file with startup message
      const startupMessage = this.formatMessage("info", "Logger initialized", {
        timestamp: Date.now(),
        pid: process.pid,
        sandboxId: this.sandboxId
      });
      writeFileSync(this.logFile, startupMessage + "\n");
    } catch (error) {
      // Fallback to console logging if file logging fails
      console.error("Failed to initialize file logging:", error);
      this.logFile = ""; // Disable file logging
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelEmoji = this.getLevelEmoji(level);
    const levelStr = level.toUpperCase().padEnd(5);

    let formatted = `${timestamp} ${levelEmoji} [${this.sandboxId}] ${message}`;

    if (context) {
      const contextStr = Object.entries(context)
        .filter(([key]) => key !== "sandboxId") // Don't duplicate sandbox ID
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");

      if (contextStr) {
        formatted += ` | ${contextStr}`;
      }
    }

    return formatted;
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case "debug": return "[DEBUG]";
      case "info": return "[INFO] ";
      case "warn": return "[WARN] ";
      case "error": return "[ERROR]";
      default: return "[LOG]  ";
    }
  }

  debug(message: string, context?: LogContext): void {
    const formatted = this.formatMessage("debug", message, context);
    if (process.env.NODE_ENV === "development") {
      console.log(formatted);
    }
    this.writeToFile(formatted);
  }

  info(message: string, context?: LogContext): void {
    const formatted = this.formatMessage("info", message, context);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  warn(message: string, context?: LogContext): void {
    const formatted = this.formatMessage("warn", message, context);
    console.warn(formatted);
    this.writeToFile(formatted);
  }

  error(message: string, error?: Error | string, context?: LogContext): void {
    let errorContext = { ...context };

    if (error) {
      if (error instanceof Error) {
        errorContext.error = error.message;
        errorContext.stack = error.stack;
      } else {
        errorContext.error = error;
      }
    }

    const formatted = this.formatMessage("error", message, errorContext);
    console.error(formatted);
    this.writeToFile(formatted);
  }

  private writeToFile(message: string): void {
    if (!this.logFile) {
      return; // File logging disabled
    }

    try {
      appendFileSync(this.logFile, message + "\n");
    } catch (error) {
      // Silent fail - don't break the application if logging fails
      console.error("Failed to write to log file:", error);
    }
  }

  // Convenience methods for common operations
  operation(name: string, context?: LogContext): OperationLogger {
    return new OperationLogger(this, name, context);
  }

  fileSync(message: string, context?: LogContext): void {
    this.info(message, { ...context, component: "file-sync" });
  }

  convex(message: string, context?: LogContext): void {
    this.info(message, { ...context, component: "convex" });
  }

  claude(message: string, context?: LogContext): void {
    this.info(message, { ...context, component: "claude-code" });
  }
}

class OperationLogger {
  private startTime: number;

  constructor(
    private logger: Logger,
    private operationName: string,
    private context?: LogContext
  ) {
    this.startTime = Date.now();
    this.logger.info(`Starting ${operationName}`, context);
  }

  success(message?: string, context?: LogContext): void {
    const duration = Date.now() - this.startTime;
    this.logger.info(
      message || `Completed ${this.operationName}`,
      { ...this.context, ...context, duration, operation: this.operationName }
    );
  }

  error(message: string, error?: Error | string, context?: LogContext): void {
    const duration = Date.now() - this.startTime;
    this.logger.error(
      `Failed ${this.operationName}: ${message}`,
      error,
      { ...this.context, ...context, duration, operation: this.operationName }
    );
  }

  progress(message: string, context?: LogContext): void {
    this.logger.info(
      `${this.operationName}: ${message}`,
      { ...this.context, ...context, operation: this.operationName }
    );
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Export for creating component-specific loggers
export { Logger };