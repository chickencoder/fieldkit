"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAction } from "next-safe-action/hooks";
import { startSandboxAction } from "@/actions/start-sandbox";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  githubRepoUrl: z.string().min(1, "GitHub repo URL is required"),
  branchName: z.string().min(1, "Branch name is required"),
  installCommand: z.string().min(1, "Install command is required"),
  developmentCommand: z.string().min(1, "Development command is required"),
  localPort: z
    .number()
    .min(1, "Port is required")
    .max(65535, "Port must be between 1 and 65535"),
});

type FormData = z.infer<typeof formSchema>;

export function HomeClient() {
  const router = useRouter();
  const { executeAsync: startSandbox, isExecuting } =
    useAction(startSandboxAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      githubRepoUrl: "",
      branchName: "main",
      installCommand: "npm install",
      developmentCommand: "npm run dev",
      localPort: 3000,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      toast.promise(startSandbox(data), {
        loading: "Starting sandbox session",
        success: (result) => {
          if (result.data?.sandboxId && result.data?.domain) {
            router.push(
              `/sandbox/${result.data.sandboxId}?domain=${result.data.domain}`,
            );
            return "Successfully created sandbox session";
          } else {
            throw new Error("Missing sandbox data");
          }
        },
        error: "Failed to start sandbox session",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to start sandbox session");
    }
  };

  return (
    <main className="max-w-xl mx-auto mt-20">
      <Card>
        <CardHeader>
          <CardTitle>Start a session</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="githubRepoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Repo URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://github.com/owner/repo"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branchName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Name</FormLabel>
                    <FormControl>
                      <Input placeholder="main" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="installCommand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Install Command</FormLabel>
                    <FormControl>
                      <Input placeholder="npm install" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="developmentCommand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Development Command</FormLabel>
                    <FormControl>
                      <Input placeholder="npm run dev" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="localPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="3000"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isExecuting}
                loading={isExecuting}
              >
                Start session
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
