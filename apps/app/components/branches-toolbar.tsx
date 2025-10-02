"use client";

import { useQueryState, parseAsString } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GitBranch } from "lucide-react";

export function BranchesToolbar() {
  const [searchQuery, setSearchQuery] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );

  return (
    <section className="flex items-center justify-between pt-2">
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
  );
}
