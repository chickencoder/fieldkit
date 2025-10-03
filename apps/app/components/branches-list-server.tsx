import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { BranchesListClient } from "./branches-list-client";

type BranchesListServerProps = {
  projectId: Id<"projects">;
  searchQuery: string;
};

export async function BranchesListServer({
  projectId,
  searchQuery,
}: BranchesListServerProps) {
  const preloadedBranches = await preloadQuery(
    api.branches.getBranchesByProject,
    {
      projectId,
    },
  );

  return (
    <BranchesListClient
      preloadedBranches={preloadedBranches}
      searchQuery={searchQuery}
    />
  );
}
