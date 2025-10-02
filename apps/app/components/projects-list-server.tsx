import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { ProjectsListClient } from "./projects-list-client";

type ProjectsListServerProps = {
  searchQuery: string;
};

export async function ProjectsListServer({
  searchQuery,
}: ProjectsListServerProps) {
  const preloadedProjects = await preloadQuery(api.projects.getUserProjects);

  return (
    <ProjectsListClient
      preloadedProjects={preloadedProjects}
      initialSearchQuery={searchQuery}
    />
  );
}
