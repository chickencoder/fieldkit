import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { ProjectsListClient } from "./projects-list-client";
import { getToken } from "@/lib/auth-server";

type ProjectsListServerProps = {
  searchQuery: string;
};

export async function ProjectsListServer({
  searchQuery,
}: ProjectsListServerProps) {
  const preloadedProjects = await preloadQuery(
    api.projects.getUserProjects,
    {},
    { token: await getToken() },
  );

  return (
    <ProjectsListClient
      preloadedProjects={preloadedProjects}
      initialSearchQuery={searchQuery}
    />
  );
}
