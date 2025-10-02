"use client";

import { Id } from "@repo/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewBranchTab } from "./new-branch-tab";
import { ExistingBranchTab } from "./existing-branch-tab";

type CreateBranchDialogContentProps = {
  projectId: Id<"projects">;
  onClose: () => void;
};

export function CreateBranchDialogContent({
  projectId,
  onClose,
}: CreateBranchDialogContentProps) {
  return (
    <Tabs defaultValue="new" className="">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="new">New Branch</TabsTrigger>
        <TabsTrigger value="existing">Existing Branch</TabsTrigger>
      </TabsList>
      <TabsContent value="new" className="space-y-6">
        <NewBranchTab projectId={projectId} onClose={onClose} />
      </TabsContent>
      <TabsContent value="existing" className="space-y-6">
        <ExistingBranchTab projectId={projectId} onClose={onClose} />
      </TabsContent>
    </Tabs>
  );
}
