import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { RepoList, type RepoListItem, type RepoSyncStatus } from "@/components/cli-sync/RepoList";
import { SyncStatusCard, type SyncAuthStatus } from "@/components/cli-sync/SyncStatusCard";
import { auth } from "@/lib/auth";
import { getUserProjects } from "@/lib/api/projects";
import { getUserCliTokens } from "@/lib/auth/cliToken";
import { timeAgo, isStale } from "@/lib/time";

function deriveAuthStatus(tokens: any[]): SyncAuthStatus {
  if (tokens.length === 0) return "missing";
  const active = tokens.some(t => !t.expiresAt || new Date(t.expiresAt) > new Date());
  return active ? "connected" : "expired";
}

export default async function CliDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cli");
  }

  const [projects, tokens] = await Promise.all([
    getUserProjects(session.user.id),
    getUserCliTokens(session.user.id),
  ]);

  const authStatus = deriveAuthStatus(tokens);
  const latestToken = tokens[0];

  const repoItems: RepoListItem[] = projects.map(p => ({
    id: p.id,
    name: p.name,
    path: p.repoRoot || "Local repo",
    status: isStale(p.updatedAt) ? "attention" : "synced",
    lastSync: timeAgo(p.updatedAt),
    snapshots: p._count.snapshots,
    issues: 0,
    branch: undefined,
  }));

  return (
    <Container className="py-mdt-10 md:py-mdt-12">
      <Stack gap={8}>
        <Stack gap={2} className="max-w-2xl">
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            CLI Sync
          </Text>
          <Heading level="h1">Snapshots and patch queues</Heading>
          <Text tone="muted">
            Keep local repos and the web workbench aligned. Upload snapshots, review audit results, and pull patches
            back into your editor.
          </Text>
        </Stack>

        <SyncStatusCard
          status={authStatus}
          deviceName={latestToken?.label || undefined}
          userLabel={session.user.username || session.user.email || undefined}
          lastHandshake={latestToken?.lastUsedAt ? timeAgo(latestToken.lastUsedAt) : undefined}
          tokenRefresh={latestToken?.expiresAt ? `in ${Math.ceil((new Date(latestToken.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days` : undefined}
        />

        <RepoList items={repoItems} />
      </Stack>
    </Container>
  );
}
