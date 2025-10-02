"use client";

import { usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProjectSettingsClientProps = {
  preloadedProject: Preloaded<typeof api.projects.getProjectById>;
};

export function ProjectSettingsClient({
  preloadedProject,
}: ProjectSettingsClientProps) {
  const project = usePreloadedQuery(preloadedProject);

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="pt-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Settings</CardTitle>
            <CardDescription>
              Configure your project settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Install Command</label>
                <Input value={project.installCommand} readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dev Command</label>
                <Input value={project.devCommand} readOnly />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Port</label>
              <Input value={project.port} readOnly className="max-w-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Repository URL</label>
              <Input value={project.htmlUrl} readOnly />
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
