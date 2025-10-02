import { BranchesToolbar } from "@/components/branches-toolbar";
import { BranchesListServer } from "@/components/branches-list-server";
import { Id } from "@repo/convex/_generated/dataModel";

type PageProps = {
  params: Promise<{ projectId: Id<"projects"> }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { projectId } = await params;
  const { q: searchQuery = "" } = await searchParams;

  return (
    <div className="space-y-4">
      <BranchesToolbar />
      <BranchesListServer projectId={projectId} searchQuery={searchQuery} />
    </div>
  );
}
