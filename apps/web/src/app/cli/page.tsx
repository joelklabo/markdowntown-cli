import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { RepoList, type RepoListItem } from "@/components/cli-sync/RepoList";
import { SyncStatusCard, type SyncAuthStatus } from "@/components/cli-sync/SyncStatusCard";
import { Suspense } from "react";

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

async function DashboardContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cli");
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            _count: { select: { auditIssues: true } },
          },
        },
        _count: { select: { snapshots: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const tokens = await prisma.cliToken.findMany({
      where: { userId: session.user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const activeTokens = tokens.filter((t) => !t.expiresAt || t.expiresAt > new Date());
    const authStatus: SyncAuthStatus =
      activeTokens.length > 0 ? "connected" : tokens.length > 0 ? "expired" : "missing";

    const repoItems: RepoListItem[] = projects.map((project) => {
      const latestSnapshot = project.snapshots[0];
      return {
        id: project.id,
        name: project.name,
        path: latestSnapshot?.repoRoot ?? project.slug ?? project.id,
        status: latestSnapshot?.status === "READY" ? "synced" : latestSnapshot?.status === "UPLOADING" ? "syncing" : "paused",
        lastSync: latestSnapshot ? `Synced ${formatRelativeTime(latestSnapshot.createdAt)}` : "Never synced",
        snapshots: project._count.snapshots,
        issues: latestSnapshot?._count.auditIssues ?? 0,
        branch: (latestSnapshot?.metadata as Record<string, unknown>)?.branch as string | undefined ?? "main",
      };
    });

    const latestToken = activeTokens[0] || tokens[0];

    return (
      <Stack gap={8}>
        <SyncStatusCard
          status={authStatus}
          deviceName={latestToken?.label ?? "CLI Device"}
          userLabel={session.user.name ?? session.user.email ?? "User"}
          lastHandshake={latestToken?.lastUsedAt ? formatRelativeTime(latestToken.lastUsedAt) : undefined}
          tokenRefresh={latestToken?.expiresAt ? `in ${Math.ceil((latestToken.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days` : undefined}
        />

        <RepoList items={repoItems} />
      </Stack>
    );
  } catch (error) {
    console.error("[CliDashboardPage]", error);
    return (
      <div className="rounded-mdt-lg border border-mdt-danger/20 bg-mdt-danger/5 p-mdt-8 text-center">
        <Stack gap={4} align="center">
          <Heading level="h3" className="text-mdt-danger">Unable to load dashboard</Heading>
          <Text tone="muted">We encountered an error while fetching your synced repositories. Please try again later.</Text>
        </Stack>
      </div>
    );
  }
}

function DashboardSkeleton() {
  return (
    <Stack gap={8} className="animate-pulse">
      <div className="h-48 rounded-mdt-lg bg-mdt-surface-subtle" />
      <Stack gap={4}>
        <div className="h-8 w-48 rounded bg-mdt-surface-subtle" />
        <div className="h-64 rounded-mdt-lg bg-mdt-surface-subtle" />
      </Stack>
    </Stack>
  );
}

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

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </Stack>
    </Container>
  );
}
