"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NewBranchTabProps = {
  projectId: Id<"projects">;
  onClose: () => void;
};

export function NewBranchTab({ projectId, onClose }: NewBranchTabProps) {
  const [newBranchName, setNewBranchName] = useState("");
  const [loading, setLoading] = useState(false);
  const upsertBranch = useMutation(api.branches.upsertBranch);

  const handleCreateNewBranch = async () => {
    if (!newBranchName.trim()) {
      toast.error("Please enter a branch name");
      return;
    }

    setLoading(true);
    try {
      await upsertBranch({
        projectId,
        name: newBranchName,
        commitSha: "",
        commitUrl: "",
        protected: false,
      });
      toast.success("Branch created successfully");
      setNewBranchName("");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create branch"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Branch Name</label>
        <Input
          placeholder="feature/my-new-feature"
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCreateNewBranch();
            }
          }}
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleCreateNewBranch} disabled={loading}>
          Create Branch
        </Button>
      </div>
    </>
  );
}
