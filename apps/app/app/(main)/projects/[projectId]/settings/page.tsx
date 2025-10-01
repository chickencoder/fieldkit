import { redirect } from "next/navigation";
import { Id } from "@repo/convex/_generated/dataModel";

type PageProps = {
  params: Promise<{ projectId: Id<"projects"> }>;
};

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/settings/general`);
}
