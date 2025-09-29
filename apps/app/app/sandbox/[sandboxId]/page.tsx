import { SandboxClient } from "@/components/sandbox-client";

export default async function SandboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ sandboxId: string }>;
  searchParams: Promise<{ domain: string }>;
}) {
  const { sandboxId } = await params;
  const { domain } = await searchParams;
  return <SandboxClient sandboxId={sandboxId} domain={domain} />;
}
