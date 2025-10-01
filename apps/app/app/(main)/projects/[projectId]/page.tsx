import ProjectDetailClient from "@/components/project-detail-client";
import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";

type PageProps = {
  params: Promise<{ projectId: Id<"projects"> }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const preloadedProject = await preloadQuery(api.projects.getProjectById, {
    projectId,
  });

  return <ProjectDetailClient preloadedProject={preloadedProject} />;
}
