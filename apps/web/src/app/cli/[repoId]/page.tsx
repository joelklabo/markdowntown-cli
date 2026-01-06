import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlobStore } from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { Editor } from "@/components/cli-sync/Editor";
import { FileTree } from "@/components/cli-sync/FileTree";
import { IssuesPanel, type CliIssue, type IssueSeverity } from "@/components/cli-sync/IssuesPanel";
import { runWasmAuditIsolated } from "@/lib/cli/wasmAudit";

type RepoDetailPageProps = {
  params: Promise<{ repoId: string }>;
};

function normalizeSeverity(value: string | undefined): IssueSeverity {
  if (!value) return "warning";
  const normalized = value.toLowerCase();
  if (normalized.includes("error")) return "error";
  if (normalized.includes("info")) return "info";
  return "warning";
}

function normalizeIssues(rawIssues: unknown[], repoRoot: string): CliIssue[] {
  return rawIssues.map((issue, index) => {
    const raw = issue as Record<string, unknown>;
    const ruleId = String(raw.ruleId ?? raw.rule_id ?? raw.rule ?? "unknown-rule");
    const severity = normalizeSeverity(String(raw.severity ?? raw.level ?? "warning"));
    const title = String(raw.title ?? raw.message ?? raw.summary ?? "Issue detected");
    const id = String(raw.id ?? raw.issueId ?? raw.fingerprint ?? `${ruleId}-${index + 1}`);
    const pathValue =
      (raw.path as string | undefined) ??
      (raw.filePath as string | undefined) ??
      (raw.file as string | undefined) ??
      (raw.location as { path?: string } | undefined)?.path ??
      "unknown";
    const filePath = pathValue.replace(`${repoRoot}/`, "");
    const summary = raw.summary ? String(raw.summary) : null;

    return {
      id,
      ruleId,
      title,
      severity,
      filePath,
      summary,
    };
  });
}

async function loadAuditIssues(files: Array<{ path: string; content: string }>) {
  const repoRoot = "/repo";
  const fallbackIssues: CliIssue[] = [
    {
      id: "audit-frontmatter-1",
      ruleId: "mdt.frontmatter.invalid",
      title: "Frontmatter YAML is malformed",
      severity: "error",
      filePath: "AGENTS.md",
      summary: "Fix YAML syntax before the CLI can apply patches.",
    },
  ];

  try {
    const repoRootDir = path.resolve(process.cwd(), "..", "..");
    const registryPath = path.join(repoRootDir, "cli", "data", "ai-config-patterns.json");
    const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));

    const result = await runWasmAuditIsolated({
      files,
      registry,
      timeoutMs: 15000,
    });

    if (!result.ok || !result.response) {
      throw new Error(result.error || "WASM audit failed");
    }

    const response = result.response;
    const rawIssues = Array.isArray(response.output?.issues) ? response.output?.issues ?? [] : [];
    const issues = normalizeIssues(rawIssues, repoRoot);

    return {
      issues,
      status: "ready" as const,
    };
  } catch (error) {
    console.error("[loadAuditIssues]", error);
    return {
      issues: fallbackIssues,
      status: "error" as const,
      error: error instanceof Error ? error.message : "WASM audit unavailable",
    };
  }
}

export default async function RepoDetailPage({ params }: RepoDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cli");
  }

  const { repoId } = await params;
  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: repoId }, { slug: repoId }],
      userId: session.user.id,
    },
  });

  if (!project) {
    notFound();
  }

  const latestSnapshot = await prisma.snapshot.findFirst({
    where: {
      projectId: project.id,
      status: "READY",
    },
    orderBy: { createdAt: "desc" },
    include: {
      files: {
        include: { blob: true },
      },
    },
  });

  if (!latestSnapshot) {
    return (
      <Container className="py-mdt-10 md:py-mdt-12">
        <Stack gap={6}>
          <Stack gap={1}>
            <Heading level="h1">{project.name}</Heading>
            <Text tone="muted">No snapshots ready for this repository.</Text>
          </Stack>
          <Button asChild variant="secondary" className="w-fit">
            <Link href="/cli">Back to dashboard</Link>
          </Button>
        </Stack>
      </Container>
    );
  }

  const blobStore = getBlobStore();
  const files = await Promise.all(
    latestSnapshot.files.map(async (file) => {
      const contentBuffer = await blobStore.getBlob(file.blob.sha256);
      return {
        path: file.path,
        content: contentBuffer?.toString("utf8") ?? "",
      };
    })
  );

  const { issues, status: auditStatus, error } = await loadAuditIssues(files);
  const selectedFile = files.find((f) => f.path === "AGENTS.md") ?? files[0];

  return (
    <Container className="py-mdt-10 md:py-mdt-12">
      <Stack gap={6}>
        <Row align="center" justify="between" wrap className="gap-mdt-4">
          <Stack gap={1} className="min-w-0">
            <Text size="caption" tone="muted" className="uppercase tracking-wide">
              CLI Sync
            </Text>
            <Heading level="h1">{project.name}</Heading>
            <Text tone="muted" className="truncate">
              Snapshot {latestSnapshot.id.substring(0, 7)} · {issues.length} issues · {files.length} files
            </Text>
          </Stack>
          <Stack gap={2} className="sm:items-start lg:items-end">
            <Button asChild size="sm" variant="secondary">
              <Link href="/cli">Back to dashboard</Link>
            </Button>
            <Pill tone={auditStatus === "error" ? "red" : "green"}>
              {auditStatus === "error" ? "Audit needs attention" : "Snapshot ready"}
            </Pill>
          </Stack>
        </Row>

        {auditStatus === "error" ? (
          <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-4 text-body-sm text-mdt-danger">
            WASM audit failed to load. {error ? `(${error})` : null}
          </div>
        ) : null}

        <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <FileTree paths={files.map((file) => file.path)} selectedPath={selectedFile?.path} />
          {selectedFile ? (
            <Editor filePath={selectedFile.path} content={selectedFile.content} />
          ) : (
            <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-8 text-center">
              <Text tone="muted">No files to display.</Text>
            </div>
          )}
          <IssuesPanel issues={issues} auditStatus={auditStatus} />
        </div>
      </Stack>
    </Container>
  );
}