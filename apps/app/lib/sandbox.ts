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
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("📦 Building and injecting worker bundle into sandbox...");

    // Build the worker bundle
    const bundle = await WorkerBundler.buildBundle();

    // Write the bundle to the sandbox
    console.log(`📤 Uploading worker bundle (${(bundle.size / 1024).toFixed(1)}KB) to sandbox...`);

    await sandbox.writeFile("/tmp/sandbox-worker.js", bundle.content);

    // Make the file executable
    const chmodResult = await runCommandInSandbox(sandbox, "chmod", ["+x", "/tmp/sandbox-worker.js"]);
    if (!chmodResult.success) {
      throw new Error(`Failed to make worker executable: ${chmodResult.error}`);
    }

    // Generate environment variables and start command
    const envVars = WorkerBundler.generateWorkerEnv(options);
    const startCommand = WorkerBundler.generateStartCommand(envVars);

    console.log("🚀 Starting worker in background...");

    // Start the worker
    const startResult = await runCommandInSandbox(sandbox, "bash", ["-c", startCommand]);
    if (!startResult.success) {
      throw new Error(`Failed to start worker: ${startResult.error}`);
    }

    // Wait a moment for the worker to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if worker is running
    const statusCommand = WorkerBundler.generateStatusCommand();
    const statusResult = await runCommandInSandbox(sandbox, "bash", ["-c", statusCommand]);

    if (statusResult.success && statusResult.output.trim() === "running") {
      console.log("✅ Worker started successfully and is running");
      return { success: true };
    } else {
      // Try to get worker logs for debugging
      const logsResult = await runCommandInSandbox(sandbox, "tail", ["-20", "/tmp/worker.log"]);
      const logs = logsResult.success ? logsResult.output : "No logs available";

      throw new Error(`Worker failed to start properly. Status: ${statusResult.output.trim()}\n\nWorker logs:\n${logs}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
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
  logs?: string;
}> {
  try {
    // Check if worker is running
    const statusCommand = WorkerBundler.generateStatusCommand();
    const statusResult = await runCommandInSandbox(sandbox, "bash", ["-c", statusCommand]);

    const isRunning = statusResult.success && statusResult.output.trim() === "running";

    let pid: string | undefined;
    if (isRunning) {
      // Get PID
      const pidResult = await runCommandInSandbox(sandbox, "cat", ["/tmp/worker.pid"]);
      if (pidResult.success) {
        pid = pidResult.output.trim();
      }
    }

    // Get recent logs
    const logsResult = await runCommandInSandbox(sandbox, "tail", ["-50", "/tmp/worker.log"]);
    const logs = logsResult.success ? logsResult.output : "No logs available";

    return {
      isRunning,
      pid,
      logs,
    };

  } catch (error) {
    console.error("❌ Failed to get worker status:", error);
    return {
      isRunning: false,
      logs: `Error getting status: ${error}`,
    };
  }
}

export async function stopWorker(sandbox: Sandbox): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("🛑 Stopping worker...");

    const stopCommand = WorkerBundler.generateStopCommand();
    const stopResult = await runCommandInSandbox(sandbox, "bash", ["-c", stopCommand]);

    if (stopResult.success) {
      console.log("✅ Worker stopped successfully");
      return { success: true };
    } else {
      throw new Error(`Failed to stop worker: ${stopResult.error}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Failed to stop worker:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
