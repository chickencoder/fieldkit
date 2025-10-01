"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

const projectImportSchema = z.object({
  owner: z.string().min(1, "Please select an owner"),
  repo: z.string().min(1, "Please select a repository"),
  installCommand: z.string().min(1, "Install command is required"),
  devCommand: z.string().min(1, "Dev command is required"),
  port: z.string().min(1, "Port is required"),
});

type ProjectImportForm = z.infer<typeof projectImportSchema>;

export default function GitHubImportDialog() {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);

  const getGithubRepos = useAction(api.github.getGithubRepos);
  const createProject = useMutation(api.projects.createProject);

  const form = useForm<ProjectImportForm>({
    resolver: zodResolver(projectImportSchema),
    defaultValues: {
      owner: "",
      repo: "",
      installCommand: "npm install",
      devCommand: "npm run dev",
      port: "3000",
    },
  });

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
        setError(result.error || "Unknown error");
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
  const selectedOwner = form.watch("owner");
  const filteredRepos = selectedOwner
    ? repos.filter((repo) => repo.owner.login === selectedOwner)
    : [];

  const onSubmit = async (data: ProjectImportForm) => {
    const selectedRepoData = repos.find(
      (repo) => repo.full_name === data.repo,
    );

    if (!selectedRepoData) {
      toast.error("Please select a repository");
      return;
    }

    try {
      await createProject({
        name: selectedRepoData.name,
        fullName: selectedRepoData.full_name,
        owner: selectedRepoData.owner.login,
        repoId: selectedRepoData.id,
        description: selectedRepoData.description ?? undefined,
        isPrivate: selectedRepoData.private,
        htmlUrl: selectedRepoData.html_url,
        installCommand: data.installCommand,
        devCommand: data.devCommand,
        port: data.port,
      });

      toast.success("Project imported successfully");
      setOpen(false);
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import project",
      );
    }
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner</FormLabel>
                      <FormControl>
                        {loading ? (
                          <Skeleton className="h-9 w-full" />
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
                                  {field.value || "Select owner..."}
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
                                          field.onChange(
                                            currentValue === field.value
                                              ? ""
                                              : currentValue,
                                          );
                                          form.setValue("repo", "");
                                          setOwnerOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === owner
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository</FormLabel>
                      <FormControl>
                        {loading ? (
                          <Skeleton className="h-9 w-full" />
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
                                  {field.value
                                    ? repos.find((r) => r.full_name === field.value)
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
                                          field.onChange(
                                            currentValue === field.value
                                              ? ""
                                              : currentValue,
                                          );
                                          setRepoOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === repo.full_name
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="installCommand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Install Command</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="npm install" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="devCommand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dev Command</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="npm run dev" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="3000" type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!loading && repos.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No repositories found
                </div>
              ) : (
                <div className="flex justify-end gap-3">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || form.formState.isSubmitting}
                  >
                    Import
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
