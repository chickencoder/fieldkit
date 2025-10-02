"use client";

import { parseAsString, useQueryState } from "nuqs";
import { GitHubImportDialog } from "./github-import-dialog";
import { Input } from "./ui/input";

export function ProjectsToolbar({
  defaultSearchQuery,
}: {
  defaultSearchQuery: string;
}) {
  const [searchQuery, setSearchQuery] = useQueryState(
    "q",
    parseAsString.withDefault(defaultSearchQuery),
  );

  return (
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
  );
}
