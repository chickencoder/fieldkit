"use client";

import { useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { useParams } from "next/navigation";
import { Id } from "@repo/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GitBranch } from "lucide-react";
import { CreateBranchDialogContent } from "./create-branch-dialog-content";

export function BranchesToolbar() {
  const [searchQuery, setSearchQuery] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );
  const [open, setOpen] = useState(false);
  const params = useParams();
  const projectId = params.projectId as Id<"projects">;

  return (
    <section className="flex items-center justify-between pt-2">
      <Input
        type="text"
        placeholder="Search branches"
        className="max-w-xs"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <GitBranch className="h-4 w-4" />
            Create Branch
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
            <DialogDescription>
              Create a new branch or import an existing one from GitHub.
            </DialogDescription>
          </DialogHeader>
          <CreateBranchDialogContent
            projectId={projectId}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
