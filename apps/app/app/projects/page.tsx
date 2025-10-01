import ProjectsClient from "@/components/projects-client";
import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";

export default async function ProjectsPage() {
  const preloadedProjects = await preloadQuery(api.projects.getUserProjects);

  return <ProjectsClient preloadedProjects={preloadedProjects} />;
}
