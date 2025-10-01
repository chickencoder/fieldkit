"use client";

import { Input } from "@/components/ui/input";
import GitHubImportDialog from "./github-import-dialog";

export default function ProjectsClient() {
  return (
    <>
      <section className="mb-4 flex items-center justify-between">
        <Input type="text" placeholder="Search projects" className="max-w-xs" />
        <GitHubImportDialog />
      </section>
      <section>
        <div className="w-full min-h-[500px] border border-dashed rounded-lg flex items-center justify-center">
          <div className="text-muted-foreground">
            <p>It's quite empty here</p>
          </div>
        </div>
      </section>
    </>
  );
}
