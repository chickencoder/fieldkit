"use client";

import { Badge } from "@/components/ui/badge";
import { NavTabs } from "@/components/nav-tabs";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import Link from "next/link";

type ProjectHeaderClientProps = {
  preloadedProject: Preloaded<typeof api.projects.getProjectById>;
};

export function ProjectHeaderClient({
  preloadedProject,
}: ProjectHeaderClientProps) {
  const project = usePreloadedQuery(preloadedProject);

  if (!project) {
    return null;
  }

  const tabs = [
    { name: "Branches", href: `/projects/${project._id}` },
    { name: "Settings", href: `/projects/${project._id}/settings` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <nav className="flex items-center gap-2 text-lg mb-2">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{project.name}</span>
        </nav>
        <div className="flex gap-2">
          {project.isPrivate && <Badge variant="outline">Private</Badge>}
        </div>
      </div>
      <NavTabs tabs={tabs} />
    </div>
  );
}
