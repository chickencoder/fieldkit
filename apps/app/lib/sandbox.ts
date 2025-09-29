import { Sandbox } from "@vercel/sandbox";
import { WorkerBundler } from "./worker-bundle";

export async function runCommandInSandbox(
  sandbox: Sandbox,
  command: string,
  args: string[] = [],
) {
  try {
    const result = await sandbox.runCommand(command, args);

    for await (const log of result.logs()) {
      console.log("LOG", log);
    }

    // Handle stdout and stderr properly
    let stdout = "";
    let stderr = "";

    try {
      stdout = await (result.stdout as () => Promise<string>)();
    } catch {
      // Failed to read stdout
    }

    try {
      stderr = await (result.stderr as () => Promise<string>)();
    } catch {
      // Failed to read stderr
    }

    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command;

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      output: stdout,
      error: stderr,
      command: fullCommand,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Command execution failed";
    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command;
    return {
      success: false,
      error: errorMessage,
      command: fullCommand,
    };
  }
}

export async function injectWorkerIntoSandbox(
  sandbox: Sandbox,
  options: {
    sandboxId: string;
    convexUrl: string;
    r2Config?: {
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucketName: string;
    };
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("📦 Building and injecting worker bundle into sandbox...");

    // Build the worker bundle
    const bundle = await WorkerBundler.buildBundle();

    // Write the bundle to the sandbox
    console.log(
      `📤 Uploading worker bundle (${(bundle.size / 1024).toFixed(1)}KB) to sandbox...`,
    );

    await sandbox.writeFiles([{
      path: "/tmp/sandbox-worker.js",
      content: Buffer.from(bundle.content)
    }]);

    // Make the file executable
    const chmodResult = await runCommandInSandbox(sandbox, "chmod", [
      "+x",
      "/tmp/sandbox-worker.js",
    ]);
    if (!chmodResult.success) {
      throw new Error(`Failed to make worker executable: ${chmodResult.error}`);
    }

    // Generate environment variables and start command
    const envVars = WorkerBundler.generateWorkerEnv(options);
    const startCommand = WorkerBundler.generateStartCommand(envVars);

    console.log("🚀 Starting worker in background...");

    // Start the worker (fire and forget - don't await the process)
    const startResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      startCommand,
    ]);

    if (!startResult.success) {
      throw new Error(`Failed to start worker: ${startResult.error}`);
    }

    console.log("✅ Worker start command executed successfully");
    console.log("📝 Worker will initialize in background - use getWorkerStatus() to check status");

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Failed to inject worker into sandbox:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function getWorkerStatus(sandbox: Sandbox): Promise<{
  isRunning: boolean;
  pid?: string;
}> {
  try {
    // Check if worker is running
    const statusCommand = WorkerBundler.generateStatusCommand();
    const statusResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      statusCommand,
    ]);

    const isRunning =
      statusResult.success && statusResult.output?.trim() === "running";

    let pid: string | undefined;
    if (isRunning) {
      // Get PID
      const pidResult = await runCommandInSandbox(sandbox, "cat", [
        "/tmp/worker.pid",
      ]);
      if (pidResult.success) {
        pid = pidResult.output?.trim();
      }
    }

    return {
      isRunning,
      pid,
    };
  } catch (error) {
    console.error("❌ Failed to get worker status:", error);
    return {
      isRunning: false,
    };
  }
}

export async function getWorkerLogs(sandbox: Sandbox): Promise<{
  success: boolean;
  logs?: string;
  error?: string;
}> {
  try {
    const logsCommand = WorkerBundler.generateLogsCommand();
    const logsResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      logsCommand,
    ]);

    return {
      success: logsResult.success,
      logs: logsResult.output,
      error: logsResult.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Failed to get worker logs:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function debugSandboxFiles(sandbox: Sandbox): Promise<{
  success: boolean;
  debug?: string;
  error?: string;
}> {
  try {
    // Check what files exist in /tmp
    const debugCommands = [
      "echo '=== /tmp directory ==='",
      "ls -la /tmp/",
      "echo '=== Worker bundle check ==='",
      "ls -la /tmp/sandbox-worker.js || echo 'Worker bundle not found'",
      "echo '=== Worker process check ==='",
      "ps aux | grep sandbox-worker || echo 'No worker processes'",
      "echo '=== Node version ==='",
      "node --version",
      "echo '=== Environment ==='",
      "env | grep -E '(CONVEX|SANDBOX|R2)' || echo 'No relevant env vars'",
    ];

    const debugResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      debugCommands.join(" && ")
    ]);

    return {
      success: debugResult.success,
      debug: debugResult.output,
      error: debugResult.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Failed to debug sandbox files:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function stopWorker(
  sandbox: Sandbox,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🛑 Stopping worker...");

    const stopCommand = WorkerBundler.generateStopCommand();
    const stopResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      stopCommand,
    ]);

    if (stopResult.success) {
      console.log("✅ Worker stopped successfully");
      return { success: true };
    } else {
      throw new Error(`Failed to stop worker: ${stopResult.error}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Failed to stop worker:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
