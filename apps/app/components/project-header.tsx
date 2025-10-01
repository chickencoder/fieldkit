"use client";

import { Badge } from "@/components/ui/badge";
import { NavTabs } from "@/components/nav-tabs";
import { ExternalLink } from "lucide-react";
import { Doc } from "@repo/convex/_generated/dataModel";
import Link from "next/link";

type ProjectHeaderProps = {
  project: Doc<"projects">;
};

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const tabs = [
    { name: "Branches", href: `/projects/${project._id}` },
    { name: "Settings", href: `/projects/${project._id}/settings` },
  ];

  return (
    <>
      <section className="mb-6">
        <div className="flex items-start justify-between">
          <div>
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
          </div>
          <div className="flex gap-2">
            {project.isPrivate && <Badge variant="outline">Private</Badge>}
          </div>
        </div>
      </section>

      <NavTabs tabs={tabs} />
    </>
  );
}
