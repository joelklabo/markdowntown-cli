import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";

export type SyncAuthStatus = "connected" | "expired" | "missing";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

type SyncStatusCopy = {
  title: string;
  description: string;
  badgeLabel: string;
  badgeTone: BadgeTone;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
};

const copyByStatus: Record<SyncAuthStatus, SyncStatusCopy> = {
  connected: {
    title: "CLI sync is active",
    description: "Snapshots and patch drafts arrive automatically when your CLI uploads a new run.",
    badgeLabel: "Connected",
    badgeTone: "success",
    primaryAction: { label: "View setup steps", href: "/docs" },
    secondaryAction: { label: "Reconnect device", href: "/signin" },
  },
  expired: {
    title: "Reconnect your CLI",
    description: "The last device token expired. Reconnect to resume snapshot uploads.",
    badgeLabel: "Expired",
    badgeTone: "warning",
    primaryAction: { label: "Reconnect CLI", href: "/docs" },
    secondaryAction: { label: "Sign in", href: "/signin" },
  },
  missing: {
    title: "Connect your CLI",
    description: "Authorize the CLI to start uploading snapshots, patches, and audit results.",
    badgeLabel: "Not connected",
    badgeTone: "neutral",
    primaryAction: { label: "Connect CLI", href: "/docs" },
    secondaryAction: { label: "Sign in", href: "/signin" },
  },
};

export type SyncStatusCardProps = {
  status: SyncAuthStatus;
  deviceName?: string;
  userLabel?: string;
  lastHandshake?: string;
  tokenRefresh?: string;
};

function buildMetaLine({
  status,
  deviceName,
  userLabel,
  lastHandshake,
  tokenRefresh,
}: SyncStatusCardProps): string {
  const parts: string[] = [];
  if (deviceName) parts.push(`Device: ${deviceName}`);
  if (userLabel) parts.push(`User: ${userLabel}`);
  if (lastHandshake) parts.push(`Last handshake ${lastHandshake}`);
  if (tokenRefresh) parts.push(`Token refresh ${tokenRefresh}`);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  if (status === "missing") {
    return "No CLI devices connected yet.";
  }

  return "No recent sync activity yet.";
}

export function SyncStatusCard(props: SyncStatusCardProps) {
  const { status } = props;
  const copy = copyByStatus[status];
  const metaLine = buildMetaLine(props);

  return (
    <Card className="grid gap-mdt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-center" padding="lg">
      <Stack gap={3}>
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          CLI connection
        </Text>
        <Heading level="h2">{copy.title}</Heading>
        <Text tone="muted" className="max-w-2xl">
          {copy.description}
        </Text>
        <Row gap={2} align="center" wrap>
          <Badge tone={copy.badgeTone}>{copy.badgeLabel}</Badge>
          <Text size="caption" tone="muted">
            {metaLine}
          </Text>
        </Row>
      </Stack>

      <Stack gap={2} className="sm:items-start lg:items-end">
        <Button asChild size="sm">
          <Link href={copy.primaryAction.href}>{copy.primaryAction.label}</Link>
        </Button>
        {copy.secondaryAction ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={copy.secondaryAction.href}>{copy.secondaryAction.label}</Link>
          </Button>
        ) : null}
      </Stack>
    </Card>
  );
}
