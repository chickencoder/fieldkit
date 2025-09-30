"use client";

import { ConversationPanel } from "./sandbox/conversation-panel";
import { PreviewPanel } from "./sandbox/preview-panel";
import type { Preloaded } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";

export function SandboxClient({
  sandboxId,
  sessionId,
  domain,
  preloadedMessages,
}: {
  sandboxId: string;
  sessionId: Id<"sessions">;
  domain: string;
  preloadedMessages: Preloaded<typeof api.sessions.getMessagesBySessionId>;
}) {
  return (
    <div className="h-dvh flex gap-2 p-2">
      <ConversationPanel
        sandboxId={sandboxId}
        sessionId={sessionId}
        preloadedMessages={preloadedMessages}
      />
      <PreviewPanel domain={domain} />
    </div>
  );
}
