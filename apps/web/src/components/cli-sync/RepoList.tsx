import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { Separator } from "@/components/ui/Separator";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

export type RepoSyncStatus = "synced" | "syncing" | "attention" | "paused";

export type RepoListItem = {
  id: string;
  name: string;
  path: string;
  status: RepoSyncStatus;
  lastSync: string;
  snapshots: number;
  issues: number;
  branch?: string;
};

type RepoListProps = {
  items: RepoListItem[];
};

type PillTone = "primary" | "yellow" | "blue" | "red" | "green" | "gray";

type StatusCopy = {
  label: string;
  tone: PillTone;
  detail: string;
};

const statusCopy: Record<RepoSyncStatus, StatusCopy> = {
  synced: { label: "Synced", tone: "green", detail: "Up to date" },
  syncing: { label: "Syncing", tone: "blue", detail: "Uploading snapshot" },
  attention: { label: "Needs attention", tone: "yellow", detail: "Action required" },
  paused: { label: "Paused", tone: "gray", detail: "Not syncing" },
};

function formatRepoMeta(item: RepoListItem): string {
  const parts = [`${item.snapshots} snapshots`, `${item.issues} issues`];
  if (item.branch) {
    parts.push(`Branch: ${item.branch}`);
  }
  return parts.join(" · ");
}

export function RepoList({ items }: RepoListProps) {
  return (
    <Stack gap={4}>
      <Row align="center" justify="between" wrap className="gap-mdt-4">
        <Stack gap={1}>
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            Synced repositories
          </Text>
          <Heading level="h2">Recent snapshots</Heading>
        </Stack>
        <Button asChild size="sm" variant="secondary">
          <Link href="/docs">Sync guide</Link>
        </Button>
      </Row>

      {items.length === 0 ? (
        <Card className="space-y-mdt-4 text-center" padding="lg" tone="raised">
          <Heading level="h3" as="h3">
            No synced repositories yet
          </Heading>
          <Text tone="muted" className="mx-auto max-w-xl">
            Connect the CLI to upload your first snapshot. Once the CLI is linked, your repos will appear here.
          </Text>
          <Button asChild size="sm">
            <Link href="/docs">Connect CLI</Link>
          </Button>
        </Card>
      ) : (
        <Card padding="lg" tone="raised" className="space-y-mdt-4">
          {items.map((item, index) => {
            const status = statusCopy[item.status];
            return (
              <div key={item.id}>
                <div className="flex flex-col gap-mdt-3 md:flex-row md:items-center md:justify-between">
                  <Stack gap={1} className="min-w-0">
                    <Link
                      href={`/cli/${item.id}`}
                      className={cn(
                        "text-body font-semibold text-mdt-text hover:text-mdt-primary",
                        interactiveBase,
                        focusRing
                      )}
                    >
                      {item.name}
                    </Link>
                    <Text size="caption" tone="muted" className="truncate">
                      {item.path}
                    </Text>
                    <Text size="caption" tone="muted">
                      {formatRepoMeta(item)}
                    </Text>
                  </Stack>
                  <div className="flex flex-wrap items-center gap-mdt-3">
                    <Pill tone={status.tone}>{status.label}</Pill>
                    <Text size="caption" tone="muted">
                      {item.lastSync}
                    </Text>
                    <Button asChild size="xs" variant="secondary">
                      <Link href={`/cli/${item.id}`}>Open repo</Link>
                    </Button>
                  </div>
                </div>
                {index < items.length - 1 ? <Separator className="my-mdt-4" /> : null}
              </div>
            );
          })}
        </Card>
      )}
    </Stack>
  );
}
