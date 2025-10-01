"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function GeneralSettingsPage() {
  const params = useParams();
  const projectId = params.projectId as Id<"projects">;
  const project = useQuery(api.projects.getProjectById, { projectId });

  if (!project) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-6">General</h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium">Install Command</label>
            <Input value={project.installCommand} readOnly />
            <p className="text-sm text-muted-foreground">
              The command to install dependencies for your project
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium">Dev Command</label>
            <Input value={project.devCommand} readOnly />
            <p className="text-sm text-muted-foreground">
              The command to start your development server
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium">Port</label>
            <Input value={project.port} readOnly className="max-w-xs" />
            <p className="text-sm text-muted-foreground">
              The port number your development server runs on
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium">Repository URL</label>
            <Input value={project.htmlUrl} readOnly />
            <p className="text-sm text-muted-foreground">
              The GitHub repository URL for this project
            </p>
          </div>

          <div className="pt-4">
            <Button>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
