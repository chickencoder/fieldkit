"use client";

import { useState, useMemo } from "react";
import { usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NavTabs } from "@/components/nav-tabs";
import { ExternalLink, Lock } from "lucide-react";
import GitHubImportDialog from "./github-import-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ProjectsClientProps = {
  preloadedProjects: Preloaded<typeof api.projects.getUserProjects>;
};

const tabs = [
  { name: "Projects", href: "/projects" },
  { name: "Settings", href: "/settings/general" },
];

export default function ProjectsClient({ preloadedProjects }: ProjectsClientProps) {
  const projects = usePreloadedQuery(preloadedProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.fullName.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const isProjectsTab = pathname === "/projects";

  return (
    <>
      <NavTabs tabs={tabs} />
      {isProjectsTab && (
        <div className="space-y-6 pt-2">
        <section className="flex items-center justify-between">
          <Input
            type="text"
            placeholder="Search projects"
            className="max-w-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <GitHubImportDialog />
        </section>
        <section>
          {filteredProjects.length === 0 ? (
            <div className="w-full min-h-[400px] border border-dashed rounded-lg flex items-center justify-center">
              <div className="text-muted-foreground text-center flex flex-col items-center">
                <p>{searchQuery ? "No projects found" : "It's quite empty here"}</p>
                {!searchQuery && (
                  <p className="text-sm mt-2">Import a GitHub repository to get started</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <Link key={project._id} href={`/projects/${project._id}`} className="block">
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
          )}
        </section>
        </div>
      )}
    </>
  );
}
