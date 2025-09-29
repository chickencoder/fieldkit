"use server";

import { actionClient } from "@/lib/safe-action";
import { runCommandInSandbox } from "@/lib/sandbox";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";

const inputSchema = z.object({
  message: z.string(),
  sandboxId: z.string(),
});

export const sendPromptAction = actionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput }) => {
    const sandbox = await Sandbox.get({ sandboxId: parsedInput.sandboxId });
    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    const claudeResponse = await runCommandInSandbox(sandbox, "sh", [
      "-c",
      `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY} claude --print --verbose --output-format=stream-json "${parsedInput.message}"`,
    ]);

    if (!claudeResponse.success) {
      throw new Error(claudeResponse.error);
    }

    return claudeResponse.output;
  });
