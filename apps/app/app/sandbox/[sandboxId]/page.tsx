import { SandboxClient } from "@/components/sandbox-client";
import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";

function isValidId(id: string): id is Id<"sessions"> {
  // Convex IDs are base64-encoded strings with specific format
  // Check basic format to ensure it's a valid Convex ID
  return /^[a-z0-9]+$/i.test(id) && id.length > 10;
}

export default async function SandboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ sandboxId: string }>;
  searchParams: Promise<{ domain: string; sessionId?: string }>;
}) {
  const { sandboxId } = await params;
  const { domain, sessionId } = await searchParams;

  // If no sessionId provided, return error or redirect
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Session</h1>
          <p className="text-muted-foreground">Session ID is required to access this sandbox</p>
        </div>
      </div>
    );
  }

  // Validate sessionId format
  if (!isValidId(sessionId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Session ID</h1>
          <p className="text-muted-foreground">The provided session ID is not valid</p>
        </div>
      </div>
    );
  }

  // Preload session data for faster initial render
  let preloadedMessages;
  try {
    preloadedMessages = await preloadQuery(api.sessions.getMessagesBySessionId, {
      sessionId: sessionId,
    });
  } catch (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Session Not Found</h1>
          <p className="text-muted-foreground">
            The session you're looking for doesn't exist or has been deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <SandboxClient
      sandboxId={sandboxId}
      sessionId={sessionId}
      domain={domain}
      preloadedMessages={preloadedMessages}
    />
  );
}
