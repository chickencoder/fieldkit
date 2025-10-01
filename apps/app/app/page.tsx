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
      console.log(data);
    });
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen space-y-8">
      <h1 className="text-7xl font-medium tracking-tighter">oracode</h1>
      <Button onClick={signIn} loading={isPending}>
        Continue with GitHub
      </Button>
    </main>
  );
}
