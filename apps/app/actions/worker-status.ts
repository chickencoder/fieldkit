"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { Sandbox } from "@vercel/sandbox";
import { getWorkerStatus, stopWorker, getWorkerLogs, debugSandboxFiles } from "@/lib/sandbox";

const sandboxIdSchema = z.object({
  sandboxId: z.string(),
});

export const getWorkerStatusAction = actionClient
  .inputSchema(sandboxIdSchema)
  .action(async ({ parsedInput }) => {
    try {
      // Connect to existing sandbox
      const sandbox = await Sandbox.get({ sandboxId: parsedInput.sandboxId });

      const status = await getWorkerStatus(sandbox);

      return {
        success: true,
        ...status,
      };
    } catch (error) {
      console.error("Failed to get worker status:", error);
      return {
        success: false,
        isRunning: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

export const stopWorkerAction = actionClient
  .inputSchema(sandboxIdSchema)
  .action(async ({ parsedInput }) => {
    try {
      // Connect to existing sandbox
      const sandbox = await Sandbox.get({ sandboxId: parsedInput.sandboxId });

      const result = await stopWorker(sandbox);

      return result;
    } catch (error) {
      console.error("Failed to stop worker:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

export const getWorkerLogsAction = actionClient
  .inputSchema(sandboxIdSchema)
  .action(async ({ parsedInput }) => {
    try {
      // Connect to existing sandbox
      const sandbox = await Sandbox.get({ sandboxId: parsedInput.sandboxId });

      const result = await getWorkerLogs(sandbox);

      return result;
    } catch (error) {
      console.error("Failed to get worker logs:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

export const debugSandboxAction = actionClient
  .inputSchema(sandboxIdSchema)
  .action(async ({ parsedInput }) => {
    try {
      // Connect to existing sandbox
      const sandbox = await Sandbox.get({ sandboxId: parsedInput.sandboxId });

      const result = await debugSandboxFiles(sandbox);

      return result;
    } catch (error) {
      console.error("Failed to debug sandbox:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });