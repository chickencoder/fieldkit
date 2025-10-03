"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTransition } from "react";

export default function Index() {
  const [isPending, startTransition] = useTransition();

  const signIn = async () => {
    startTransition(async () => {
      const data = await authClient.signIn.social({
        provider: "github",
      });
      console.log({ data });
    });
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-7xl font-medium tracking-tighter mb-8">oracode</h1>
      <p className="font-mono text-sm text-muted-foreground mb-12">
        Claude Code in your browser
      </p>
      <Button onClick={signIn} loading={isPending}>
        Continue with GitHub
      </Button>
    </main>
  );
}
