import { Sandbox } from "@vercel/sandbox";
import { WorkerBundler } from "./worker-bundle";
import type {
  CommandResult,
  WorkerOptions,
  WorkerStatus,
  WorkerLogsResult,
  DebugResult,
  ServiceResult,
} from "./types";

export async function runCommandInSandbox(
  sandbox: Sandbox,
  command: string,
  args: string[] = [],
): Promise<CommandResult> {
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
    } catch (error) {
      console.warn("Failed to read stdout:", error);
    }

    try {
      stderr = await (result.stderr as () => Promise<string>)();
    } catch (error) {
      console.warn("Failed to read stderr:", error);
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
  options: WorkerOptions,
): Promise<ServiceResult> {
  try {
    console.log("Building and injecting worker bundle into sandbox...");

    // Build the worker bundle
    const bundle = await WorkerBundler.buildBundle();

    // Write the bundle to the sandbox
    console.log(
      `Uploading worker bundle (${(bundle.size / 1024).toFixed(1)}KB) to sandbox...`,
    );

    await sandbox.writeFiles([
      {
        path: "/tmp/sandbox-worker.js",
        content: Buffer.from(bundle.content),
      },
    ]);

    // Make the file executable
    const chmodResult = await runCommandInSandbox(sandbox, "chmod", [
      "+x",
      "/tmp/sandbox-worker.js",
    ]);
    if (!chmodResult.success) {
      throw new Error(`Failed to make worker executable: ${chmodResult.error}`);
    }

    // Install required dependencies globally
    console.log("Installing @anthropic-ai/claude-agent-sdk and @anthropic-ai/sdk globally...");
    const installResult = await runCommandInSandbox(sandbox, "npm", [
      "install",
      "-g",
      "@anthropic-ai/claude-agent-sdk",
      "@anthropic-ai/sdk",
    ]);
    if (!installResult.success) {
      throw new Error(
        `Failed to install dependencies: ${installResult.error}`,
      );
    }
    console.log("Dependencies installed successfully");

    // Generate environment variables and start command
    const envVars = WorkerBundler.generateWorkerEnv(options);
    const startCommand = WorkerBundler.generateStartCommand(envVars);

    console.log("Starting worker in background...");

    // Start the worker (fire and forget - don't await the process)
    const startResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      startCommand,
    ]);

    if (!startResult.success) {
      throw new Error(`Failed to start worker: ${startResult.error}`);
    }

    console.log("Worker start command executed successfully");
    console.log(
      "Worker will initialize in background - use getWorkerStatus() to check status",
    );

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Failed to inject worker into sandbox:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function getWorkerStatus(sandbox: Sandbox): Promise<WorkerStatus> {
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
    console.error("Failed to get worker status:", error);
    return {
      isRunning: false,
    };
  }
}

export async function getWorkerLogs(
  sandbox: Sandbox,
): Promise<WorkerLogsResult> {
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Failed to get worker logs:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function debugSandboxFiles(
  sandbox: Sandbox,
): Promise<DebugResult> {
  try {
    // Check what files exist in /tmp
    const debugCommands = [
      "echo '=== /tmp directory ==='",
      "ls -la /tmp/",
      "echo '=== Worker bundle check ==='",
      "ls -la /tmp/sandbox-worker.js || echo 'Worker bundle not found'",
      "echo '=== Worker process check ==='",
      "ps aux | grep sandbox-worker || echo 'No worker processes'",
      "echo '=== Development server processes ==='",
      "ps aux | grep -E '(next|npm|node)' | grep -v grep || echo 'No dev server processes'",
      "echo '=== Development server logs (nohup.out) ==='",
      "ls -la nohup.out && tail -50 nohup.out || echo 'No nohup.out found'",
      "echo '=== Development server logs (/tmp) ==='",
      "ls -la /tmp/*.log 2>/dev/null && tail -50 /tmp/*.log 2>/dev/null || echo 'No log files in /tmp'",
      "echo '=== Current directory and files ==='",
      "pwd && ls -la",
      "echo '=== Package.json check ==='",
      "ls -la package.json && head -20 package.json || echo 'No package.json found'",
      "echo '=== Next.js build files ==='",
      "ls -la .next/ 2>/dev/null || echo 'No .next directory found'",
      "echo '=== Network connections ==='",
      "netstat -tlnp 2>/dev/null | grep :300 || echo 'No services on port 3000'",
      "echo '=== Node version ==='",
      "node --version",
      "echo '=== Environment ==='",
      "env | grep -E '(CONVEX|SANDBOX|R2|NODE_ENV|PORT)' || echo 'No relevant env vars'",
    ];

    const debugResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      debugCommands.join(" && "),
    ]);

    return {
      success: debugResult.success,
      debug: debugResult.output,
      error: debugResult.error,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Failed to debug sandbox files:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function startProxyServer(
  sandbox: Sandbox,
  localPort: number,
  proxyPort: number = 8080,
): Promise<ServiceResult> {
  try {
    console.log(
      `Starting proxy server: localhost:${proxyPort} → localhost:${localPort}`,
    );

    // Create a simple HTTP proxy script
    const proxyScript = `
const http = require('http');
const net = require('net');

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Forward HTTP requests
  console.log('Proxying HTTP request:', req.method, req.url);
  const options = {
    hostname: 'localhost',
    port: ${localPort},
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:${localPort}'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('HTTP Proxy error:', err);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end('Bad Gateway');
    }
  });

  req.pipe(proxyReq, { end: true });
});

// Handle WebSocket upgrade requests
server.on('upgrade', (req, socket, head) => {
  console.log('WebSocket upgrade request for:', req.url);

  // Create connection to the target server
  const targetSocket = net.createConnection(${localPort}, 'localhost');

  targetSocket.on('connect', () => {
    // Forward the upgrade request
    const upgradeHeaders = [
      \`\${req.method} \${req.url} HTTP/\${req.httpVersion}\`,
      ...Object.keys(req.headers).map(key => \`\${key}: \${req.headers[key]}\`)
    ].join('\\r\\n') + '\\r\\n\\r\\n';

    targetSocket.write(upgradeHeaders);
    targetSocket.write(head);

    // Pipe data bidirectionally
    socket.pipe(targetSocket);
    targetSocket.pipe(socket);
  });

  targetSocket.on('error', (err) => {
    console.error('WebSocket proxy error:', err);
    socket.end();
  });

  socket.on('error', (err) => {
    console.error('WebSocket client error:', err);
    targetSocket.end();
  });
});

server.listen(${proxyPort}, () => {
  console.log('HTTP/WebSocket proxy server running on port ${proxyPort}');
});
`;

    // Write the proxy script to the sandbox
    await sandbox.writeFiles([
      {
        path: "/tmp/proxy-server.js",
        content: Buffer.from(proxyScript),
      },
    ]);

    // Start the proxy server in the background
    const startCommand =
      "nohup node /tmp/proxy-server.js > /tmp/proxy.log 2>&1 & echo $! > /tmp/proxy.pid";
    const startResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      startCommand,
    ]);

    if (!startResult.success) {
      throw new Error(`Failed to start proxy server: ${startResult.error}`);
    }

    // Wait a moment and check if the proxy is running
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const checkResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      "ps aux | grep proxy-server.js | grep -v grep || echo 'not running'",
    ]);

    // Always check proxy logs for debugging
    const logResult = await runCommandInSandbox(sandbox, "cat", [
      "/tmp/proxy.log",
    ]);
    console.log("Proxy server logs:", logResult.output);

    if (checkResult.output?.includes("not running")) {
      throw new Error(
        `Proxy server failed to start. Logs: ${logResult.output}`,
      );
    }

    console.log("Proxy server started successfully");
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Failed to start proxy server:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function stopWorker(sandbox: Sandbox): Promise<ServiceResult> {
  try {
    console.log("Stopping worker...");

    const stopCommand = WorkerBundler.generateStopCommand();
    const stopResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      stopCommand,
    ]);

    if (stopResult.success) {
      console.log("Worker stopped successfully");
      return { success: true };
    } else {
      throw new Error(`Failed to stop worker: ${stopResult.error}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Failed to stop worker:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
