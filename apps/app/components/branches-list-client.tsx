"use client";

import { useMemo } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { GitBranch } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@repo/convex/_generated/dataModel";
import { useAction } from "next-safe-action/hooks";
import { launchSandboxAction } from "@/actions/launch-sandbox";
import { toast } from "sonner";

type BranchesListClientProps = {
  preloadedBranches: Preloaded<typeof api.branches.getBranchesByProject>;
  searchQuery: string;
};

export function BranchesListClient({
  preloadedBranches,
  searchQuery,
}: BranchesListClientProps) {
  const branches = usePreloadedQuery(preloadedBranches);
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as Id<"projects">;

  const { execute: executeLaunchSandbox, isExecuting } =
    useAction(launchSandboxAction);

  const filteredBranches = useMemo(() => {
    if (!searchQuery) return branches;

    const query = searchQuery.toLowerCase();
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(query),
    );
  }, [branches, searchQuery]);

  const handleBranchClick = async (branchId: Id<"branches">) => {
    const result = await executeLaunchSandbox({
      projectId,
      branchId,
    });

    console.log("Launch sandbox result:", result);

    if (result?.data) {
      router.push(`/sandbox/${result.data.sessionId}`);
      toast.success("Sandbox launched successfully!");
    } else if (result?.serverError) {
      toast.error(`Server error: ${result.serverError}`);
    } else if (result?.validationErrors) {
      toast.error("Validation error");
    } else {
      toast.error("Failed to launch sandbox");
    }
  };

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
        <button
          key={branch._id}
          onClick={() => handleBranchClick(branch._id)}
          disabled={isExecuting}
          className="w-full border rounded-lg p-4 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
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
        </button>
      ))}
    </div>
  );
}
