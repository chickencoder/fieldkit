"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { Sandbox } from "@vercel/sandbox";
import { getWorkerStatus, stopWorker } from "@/lib/sandbox";

const sandboxIdSchema = z.object({
  sandboxId: z.string(),
});

export const getWorkerStatusAction = actionClient
  .inputSchema(sandboxIdSchema)
  .action(async ({ parsedInput }) => {
    try {
      // Create sandbox connection (this doesn't create a new sandbox, just connects to existing one)
      const sandbox = new Sandbox({ sandboxId: parsedInput.sandboxId });

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
      // Create sandbox connection
      const sandbox = new Sandbox({ sandboxId: parsedInput.sandboxId });

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