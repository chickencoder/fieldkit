"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  html_url: string;
};

export default function GitHubImportDialog() {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [installCommand, setInstallCommand] = useState("npm install");
  const [devCommand, setDevCommand] = useState("npm run dev");
  const [port, setPort] = useState("3000");

  const getGithubRepos = useAction(api.github.getGithubRepos);

  // Fetch repos when dialog opens
  // Always refetch if there was a permissions error (user might have just granted access)
  useEffect(() => {
    if (open && !loading) {
      const shouldRefetch =
        repos.length === 0 || error?.includes("re-authenticate");
      if (shouldRefetch) {
        setError(null);
        fetchRepos();
      }
    }
  }, [open]);

  // Retry fetching repos
  const handleRetry = async () => {
    setRepos([]);
    setError(null);
    await fetchRepos();
  };

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getGithubRepos({});

      if (result.success) {
        setRepos(result.repos);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch repositories",
      );
    } finally {
      setLoading(false);
    }
  };

  // Get unique owners from repos
  const owners = Array.from(
    new Set(repos.map((repo) => repo.owner.login)),
  ).sort();

  // Filter repos by selected owner
  const filteredRepos = selectedOwner
    ? repos.filter((repo) => repo.owner.login === selectedOwner)
    : [];

  const handleImport = () => {
    // Handle import logic here
    const selectedRepoData = repos.find(
      (repo) => repo.full_name === selectedRepo,
    );
    console.log({
      selectedOwner,
      selectedRepo,
      repoData: selectedRepoData,
      installCommand,
      devCommand,
      port,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Import from GitHub</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Select a GitHub repository to import.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
            {error.includes("re-authenticate") ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  // Request additional scopes using linkSocial
                  // This maintains the existing account while requesting new permissions
                  await authClient.linkSocial({
                    provider: "github",
                    callbackURL: window.location.pathname,
                  });
                }}
              >
                Grant Repository Access
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRetry}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {!error && (
          <>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="owner">
                    Owner
                  </label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={ownerOpen}
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate text-left">
                            {selectedOwner || "Select owner..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search owner..." />
                          <CommandList>
                            <CommandEmpty>No owner found.</CommandEmpty>
                            <CommandGroup>
                              {owners.map((owner) => (
                                <CommandItem
                                  key={owner}
                                  value={owner}
                                  onSelect={(currentValue) => {
                                    setSelectedOwner(
                                      currentValue === selectedOwner
                                        ? ""
                                        : currentValue,
                                    );
                                    setSelectedRepo("");
                                    setOwnerOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedOwner === owner
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {owner}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="repo">
                    Repository
                  </label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Popover open={repoOpen} onOpenChange={setRepoOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={repoOpen}
                          disabled={!selectedOwner}
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate text-left">
                            {selectedRepo
                              ? repos.find((r) => r.full_name === selectedRepo)
                                  ?.name
                              : "Select repository..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search repository..." />
                          <CommandList>
                            <CommandEmpty>No repository found.</CommandEmpty>
                            <CommandGroup>
                              {filteredRepos.map((repo) => (
                                <CommandItem
                                  key={repo.id}
                                  value={repo.full_name}
                                  onSelect={(currentValue) => {
                                    setSelectedRepo(
                                      currentValue === selectedRepo
                                        ? ""
                                        : currentValue,
                                    );
                                    setRepoOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedRepo === repo.full_name
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  <div className="flex items-center gap-2">
                                    <span>{repo.name}</span>
                                    {repo.private && (
                                      <span className="text-xs text-muted-foreground">
                                        (private)
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="installCommand"
                  >
                    Install Command
                  </label>
                  <Input
                    id="installCommand"
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    placeholder="npm install"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="devCommand">
                    Dev Command
                  </label>
                  <Input
                    id="devCommand"
                    value={devCommand}
                    onChange={(e) => setDevCommand(e.target.value)}
                    placeholder="npm run dev"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="port">
                  Port Number
                </label>
                <Input
                  id="port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3000"
                  type="number"
                />
              </div>
            </div>

            {!loading && repos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No repositories found
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || !selectedOwner || !selectedRepo}
                >
                  Import
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
