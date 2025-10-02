import { Id } from "@repo/convex/_generated/dataModel";
import { GeneralSettingsServer } from "@/components/general-settings-server";

type PageProps = {
  params: Promise<{ projectId: Id<"projects"> }>;
};

export default async function GeneralSettingsPage({ params }: PageProps) {
  const { projectId } = await params;

  return <GeneralSettingsServer projectId={projectId} />;
}
