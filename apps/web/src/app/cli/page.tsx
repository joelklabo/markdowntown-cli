import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { RepoList, type RepoListItem } from "@/components/cli-sync/RepoList";
import { SyncStatusCard, type SyncAuthStatus } from "@/components/cli-sync/SyncStatusCard";

const repoItems: RepoListItem[] = [
  {
    id: "markdowntown-cli",
    name: "markdowntown-cli",
    path: "~/code/markdowntown-cli",
    status: "synced",
    lastSync: "Synced 12 minutes ago",
    snapshots: 14,
    issues: 3,
    branch: "main",
  },
  {
    id: "atlas-engine",
    name: "atlas-engine",
    path: "~/code/atlas-engine",
    status: "syncing",
    lastSync: "Uploading snapshot now",
    snapshots: 8,
    issues: 0,
    branch: "develop",
  },
  {
    id: "audit-kit",
    name: "audit-kit",
    path: "~/code/audit-kit",
    status: "attention",
    lastSync: "Sync failed 2 days ago",
    snapshots: 22,
    issues: 6,
    branch: "main",
  },
];

const authStatus: SyncAuthStatus = "connected";

export default function CliDashboardPage() {
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
          deviceName="Codex CLI"
          userLabel="honk"
          lastHandshake="8 minutes ago"
          tokenRefresh="in 26 days"
        />

        <RepoList items={repoItems} />
      </Stack>
    </Container>
  );
}
