"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";

export default function Home({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.messages.getAllMessages>;
}) {
  const data = usePreloadedQuery(preloaded);
  return (
    <>
      <div className="flex flex-col gap-4 bg-slate-200 dark:bg-slate-800 p-4 rounded-md">
        <h2 className="text-xl font-bold">Reactive client-loaded data</h2>
        <code>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </code>
      </div>
    </>
  );
}
