"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectsClient() {
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");

  return (
    <>
      <section className="mb-4 flex items-center justify-between">
        <Input type="text" placeholder="Search projects" className="max-w-xs" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Import from GitHub</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import from GitHub</DialogTitle>
              <DialogDescription>
                Select a GitHub organization and repository to import.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="org">
                  GitHub Organization
                </label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger id="org">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="vercel">Vercel</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="repo">
                  GitHub Repository
                </label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger id="repo">
                    <SelectValue placeholder="Select repository" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-code">claude-code</SelectItem>
                    <SelectItem value="next.js">next.js</SelectItem>
                    <SelectItem value="react">react</SelectItem>
                    <SelectItem value="typescript">typescript</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle import logic here
                  console.log({ selectedOrg, selectedRepo });
                  setOpen(false);
                }}
                disabled={!selectedOrg || !selectedRepo}
              >
                Import
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
