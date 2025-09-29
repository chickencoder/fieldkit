"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import { runCommandInSandbox, injectWorkerIntoSandbox, startProxyServer } from "@/lib/sandbox";

const inputSchema = z.object({
  githubRepoUrl: z.string().url(),
  branchName: z.string(),
  installCommand: z.string(),
  developmentCommand: z.string(),
  localPort: z.number(),
});

export const startSandboxAction = actionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput }) => {
    console.log("Received parsed input:", parsedInput);
    const proxyPort = 3001;

    try {
      console.log("Creating sandbox...");
      const sandbox = await Sandbox.create({
        source: {
          type: "git",
          url: parsedInput.githubRepoUrl,
        },
        resources: { vcpus: 4 },
        ports: [proxyPort],
        timeout: ms("10m"),
      });
      console.log("Sandbox created:", sandbox.sandboxId);


    // Inject and start the sandbox worker
    console.log("injecting sandbox worker");

    // Get Convex URL (check multiple possible sources)
    const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!convexUrl) {
      console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
    } else {
      const workerResult = await injectWorkerIntoSandbox(sandbox, {
        sandboxId: sandbox.sandboxId,
        convexUrl,
        r2Config: process.env.R2_ENDPOINT ? {
          endpoint: process.env.R2_ENDPOINT,
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          bucketName: process.env.R2_BUCKET_NAME!,
        } : undefined,
      });

      if (!workerResult.success) {
        console.warn("⚠️ Failed to inject worker, continuing without it:", workerResult.error);
      }
    }

    console.log("running install command");
    const installCommand = await runCommandInSandbox(sandbox, "sh", [
      "-c",
      parsedInput.installCommand,
    ]);

    if (!installCommand.success) {
      throw new Error(installCommand.error);
    }

    console.log("running development command");
    runCommandInSandbox(sandbox, "sh", ["-c", parsedInput.developmentCommand]);

    console.log("starting proxy server");
    const proxyResult = await startProxyServer(sandbox, parsedInput.localPort, proxyPort);

    if (!proxyResult.success) {
      console.warn("⚠️ Failed to start proxy server, continuing without it:", proxyResult.error);
    }

    return {
      sandboxId: sandbox.sandboxId,
      domain: sandbox.domain(proxyPort),
    };
    } catch (error) {
      console.error("Sandbox action failed:", error);
      throw error;
    }
  });
