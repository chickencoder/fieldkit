"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import { runCommandInSandbox, injectWorkerIntoSandbox } from "@/lib/sandbox";
import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";

const inputSchema = z.object({
  projectId: z.string(),
  branchId: z.string(),
});

export const launchSandboxAction = actionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput }) => {
    const convexUrl =
      process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL not found");
    }

    const convexClient = new ConvexClient(convexUrl);

    // Type cast the IDs from strings
    const projectId = parsedInput.projectId as Id<"projects">;
    const branchId = parsedInput.branchId as Id<"branches">;

    // Check if there's already an active sandbox for this project/branch
    const existingSandbox = await convexClient.query(
      api.sandboxes.getActiveSandbox,
      { projectId, branchId },
    );

    if (existingSandbox) {
      console.log("Found existing active sandbox:", existingSandbox.sandboxId);

      // Get or create a session for this sandbox
      let session = await convexClient.query(
        api.sessions.getLatestSessionBySandbox,
        { sandboxId: existingSandbox._id },
      );

      if (!session) {
        // Create a new session for the existing sandbox
        const sessionId = await convexClient.mutation(
          api.sessions.createSession,
          {
            sandboxId: existingSandbox._id,
          },
        );
        session = await convexClient.query(api.sessions.getSessionById, {
          sessionId,
        });
      }

      return {
        sandboxId: existingSandbox.sandboxId,
        sessionId: session!._id,
        domain: existingSandbox.domain,
      };
    }

    // No active sandbox, need to create one
    console.log("No active sandbox found, creating new one...");

    // Fetch project and branch data
    const project = await convexClient.query(api.projects.getProjectById, {
      projectId,
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const branches = await convexClient.query(
      api.branches.getBranchesByProject,
      {
        projectId,
      },
    );

    const branch = branches.find((b) => b._id === branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }

    console.log("Creating sandbox for:", {
      repo: project.htmlUrl,
      branch: branch.name,
    });

    try {
      // Prepare sandbox creation config
      const sandboxConfig: any = {
        source: {
          type: "git",
          url: project.htmlUrl,
          revision: branch.name,
        },
        resources: { vcpus: 4 },
        ports: [parseInt(project.port)],
        timeout: ms("1h"),
      };

      // Add GitHub token for private repos
      if (project.isPrivate) {
        const githubToken = process.env.VERCEL_OIDC_TOKEN;
        if (!githubToken) {
          throw new Error(
            "VERCEL_OIDC_TOKEN not found - required for private repositories",
          );
        }
        sandboxConfig.source.auth = {
          token: githubToken,
        };
      }

      console.log("Creating sandbox...");
      const sandbox = await Sandbox.create(sandboxConfig);
      console.log("Sandbox created:", sandbox.sandboxId);

      // Get the public domain for the dev server port
      const publicDomain = sandbox.domain(parseInt(project.port));
      console.log("Public domain:", publicDomain);

      // Save sandbox record to Convex first
      const sandboxId = await convexClient.mutation(
        api.sandboxes.createSandbox,
        {
          projectId,
          branchId,
          sandboxId: sandbox.sandboxId,
          domain: publicDomain,
        },
      );
      console.log("Sandbox record created:", sandboxId);

      // Create a new session for this sandbox
      const sessionId = await convexClient.mutation(
        api.sessions.createSession,
        {
          sandboxId,
        },
      );
      console.log("Session created:", sessionId);

      // Inject and start the sandbox worker
      console.log("Injecting sandbox worker");

      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: sandbox.sandboxId,
          convexUrl,
          sessionId,
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

      console.log("Running install command");
      const installCommand = await runCommandInSandbox(sandbox, "sh", [
        "-c",
        project.installCommand,
      ]);

      if (!installCommand.success) {
        throw new Error(installCommand.error);
      }

      console.log("Running development command");
      runCommandInSandbox(sandbox, "sh", ["-c", project.devCommand]);

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
