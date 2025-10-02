"use client";

import { useMemo } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { GitBranch } from "lucide-react";

type BranchesListClientProps = {
  preloadedBranches: Preloaded<typeof api.branches.getBranchesByProject>;
  searchQuery: string;
};

export function BranchesListClient({
  preloadedBranches,
  searchQuery,
}: BranchesListClientProps) {
  const branches = usePreloadedQuery(preloadedBranches);

  const filteredBranches = useMemo(() => {
    if (!searchQuery) return branches;

    const query = searchQuery.toLowerCase();
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(query)
    );
  }, [branches, searchQuery]);

  if (filteredBranches.length === 0) {
    return (
      <div className="w-full min-h-[400px] border border-dashed rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground text-center flex flex-col items-center">
          <p>{searchQuery ? "No branches found" : "No branches yet"}</p>
          <p className="text-sm mt-2">
            {searchQuery
              ? "Try a different search term"
              : "Create a branch to get started"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredBranches.map((branch) => (
        <div
          key={branch._id}
          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{branch.name}</p>
                <p className="text-sm text-muted-foreground">
                  {branch.commitSha.substring(0, 7)}
                </p>
              </div>
            </div>
            {branch.protected && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                Protected
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
