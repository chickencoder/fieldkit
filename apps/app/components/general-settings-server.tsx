import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { GeneralSettingsClient } from "./general-settings-client";

type GeneralSettingsServerProps = {
  projectId: Id<"projects">;
};

export async function GeneralSettingsServer({
  projectId,
}: GeneralSettingsServerProps) {
  const preloadedProject = await preloadQuery(api.projects.getProjectById, {
    projectId,
  });

  return <GeneralSettingsClient preloadedProject={preloadedProject} />;
}
