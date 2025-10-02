"use client";

import { useEffect, useMemo } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Lock } from "lucide-react";
import Link from "next/link";
import { ProjectsListSkeleton } from "./projects-list-skeleton";
import { parseAsString, useQueryState } from "nuqs";

type ProjectsListClientProps = {
  preloadedProjects: Preloaded<typeof api.projects.getUserProjects>;
  initialSearchQuery: string;
};

export function ProjectsListClient({
  preloadedProjects,
  initialSearchQuery,
}: ProjectsListClientProps) {
  const projects = usePreloadedQuery(preloadedProjects);
  const [searchQuery] = useQueryState(
    "q",
    parseAsString.withDefault(initialSearchQuery),
  );

  const filteredProjects = useMemo(() => {
    if (!projects || !searchQuery) return projects || [];

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.fullName.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query),
    );
  }, [projects, searchQuery]);

  if (!projects) {
    return <ProjectsListSkeleton />;
  }

  if (filteredProjects.length === 0) {
    return (
      <div className="w-full min-h-[400px] border border-dashed rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground text-center flex flex-col items-center">
          <p>{searchQuery ? "No projects found" : "It's quite empty here"}</p>
          {!searchQuery && (
            <p className="text-sm mt-2">
              Import a GitHub repository to get started
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredProjects.map((project) => (
        <Link
          key={project._id}
          href={`/projects/${project._id}`}
          className="block"
        >
          <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{project.name}</h3>
              {project.isPrivate && (
                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {project.fullName}
            </p>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {project.description}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
