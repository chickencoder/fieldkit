"use client";

import { useState, useEffect } from "react";
import { usePreloadedQuery, Preloaded, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectHeader } from "@/components/project-header";
import { GitBranch } from "lucide-react";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectDetailClientProps = {
  preloadedProject: Preloaded<typeof api.projects.getProjectById>;
};

type Branch = {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
};

export default function ProjectDetailClient({
  preloadedProject,
}: ProjectDetailClientProps) {
  const project = usePreloadedQuery(preloadedProject);
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const getBranches = useAction(api.github.getBranches);

  useEffect(() => {
    if (project) {
      setIsLoading(true);
      getBranches({ fullName: project.fullName })
        .then((result) => {
          if (result.success && "branches" in result) {
            setBranches(result.branches);
          } else if ("error" in result) {
            setError(result.error || "Unknown error");
          }
        })
        .catch((err) => {
          setError(err?.message || "Failed to fetch branches");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [project, getBranches]);

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const isBranchesTab = pathname === `/projects/${project._id}`;

  const filteredBranches = branches?.filter((branch) =>
    branch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <ProjectHeader project={project} />

      {isBranchesTab && (
        <div className="space-y-6 pt-2">
          <section className="flex items-center justify-between">
            <Input
              type="text"
              placeholder="Search branches"
              className="max-w-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button className="gap-2">
              <GitBranch className="h-4 w-4" />
              Create Branch
            </Button>
          </section>

          <section>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="w-full min-h-[400px] border border-dashed rounded-lg flex items-center justify-center">
                <div className="text-destructive text-center flex flex-col items-center">
                  <p>Error loading branches</p>
                  <p className="text-sm mt-2">{error}</p>
                </div>
              </div>
            ) : filteredBranches && filteredBranches.length > 0 ? (
              <div className="space-y-2">
                {filteredBranches.map((branch) => (
                  <div
                    key={branch.name}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{branch.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {branch.commit.sha.substring(0, 7)}
                          </p>
                        </div>
                      </div>
                      {branch.protected && (
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          Protected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full min-h-[400px] border border-dashed rounded-lg flex items-center justify-center">
                <div className="text-muted-foreground text-center flex flex-col items-center">
                  <p>No branches found</p>
                  <p className="text-sm mt-2">
                    {searchQuery
                      ? "Try a different search term"
                      : "Create a branch to get started"}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
