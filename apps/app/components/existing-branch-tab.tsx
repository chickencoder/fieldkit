"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Branch = {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
};

type ExistingBranchTabProps = {
  projectId: Id<"projects">;
  onClose: () => void;
};

export function ExistingBranchTab({
  projectId,
  onClose,
}: ExistingBranchTabProps) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upsertBranch = useMutation(api.branches.upsertBranch);
  const project = useQuery(api.projects.getProjectById, { projectId });
  const getBranches = useAction(api.github.getBranches);

  useEffect(() => {
    if (project && branches.length === 0 && !fetchingBranches && !error) {
      loadBranches();
    }
  }, [project]);

  const loadBranches = async () => {
    if (!project) return;

    setFetchingBranches(true);
    setError(null);

    try {
      const result = await getBranches({ fullName: project.fullName });

      if (result.success && "branches" in result) {
        setBranches(result.branches);
      } else if ("error" in result) {
        setError(result.error || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch branches");
    } finally {
      setFetchingBranches(false);
    }
  };

  const handleImport = async () => {
    if (!selectedBranch) {
      toast.error("Please select a branch");
      return;
    }

    setLoading(true);
    try {
      const branch = branches.find((b) => b.name === selectedBranch);
      if (!branch) {
        toast.error("Branch not found");
        return;
      }

      await upsertBranch({
        projectId,
        name: branch.name,
        commitSha: branch.commit.sha,
        commitUrl: branch.commit.url,
        protected: branch.protected,
      });
      toast.success("Branch imported successfully");
      setSelectedBranch("");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import branch",
      );
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Branch</label>
        {fetchingBranches ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a branch from GitHub" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  <div className="flex items-center gap-2">
                    {branch.name}
                    {branch.protected && (
                      <span className="text-xs text-muted-foreground">
                        (protected)
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={loading || fetchingBranches || !selectedBranch}
        >
          Import Branch
        </Button>
      </div>
    </>
  );
}
