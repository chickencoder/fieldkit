"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import {
  runCommandInSandbox,
  injectWorkerIntoSandbox,
} from "@/lib/sandbox";
import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";

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

    try {
      console.log("Creating sandbox...");
      const sandbox = await Sandbox.create({
        source: {
          type: "git",
          url: parsedInput.githubRepoUrl,
        },
        resources: { vcpus: 4 },
        ports: [parsedInput.localPort], // Expose the dev server port directly
        timeout: ms("1h"),
      });
      console.log("Sandbox created:", sandbox.sandboxId);

      // Create a new session for this sandbox
      const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        throw new Error("CONVEX_URL not found");
      }

      const convexClient = new ConvexClient(convexUrl);
      const sessionId = await convexClient.mutation(api.sessions.createSession, {
        sandboxId: sandbox.sandboxId,
      });
      console.log("Session created:", sessionId);

      // Inject and start the sandbox worker
      console.log("injecting sandbox worker");

      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: sandbox.sandboxId,
          convexUrl,
          sessionId, // Pass the session ID to the worker
          r2Config: process.env.R2_ENDPOINT
            ? {
                endpoint: process.env.R2_ENDPOINT,
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
                bucketName: process.env.R2_BUCKET_NAME!,
              }
            : undefined,
        });

        if (!workerResult.success) {
          console.warn(
            "⚠️ Failed to inject worker, continuing without it:",
            workerResult.error,
          );
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
      runCommandInSandbox(sandbox, "sh", [
        "-c",
        parsedInput.developmentCommand,
      ]);

      // Get the public domain for the dev server port
      const publicDomain = sandbox.domain(parsedInput.localPort);
      console.log("Public domain:", publicDomain);

      return {
        sandboxId: sandbox.sandboxId,
        sessionId,
        domain: publicDomain,
      };
    } catch (error) {
      console.error("Sandbox action failed:", error);
      throw error;
    }
  });
