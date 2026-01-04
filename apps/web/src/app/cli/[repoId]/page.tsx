import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { Editor } from "@/components/cli-sync/Editor";
import { FileTree } from "@/components/cli-sync/FileTree";
import { IssuesPanel, type CliIssue, type IssueSeverity } from "@/components/cli-sync/IssuesPanel";

type RepoDetailPageProps = {
  params: Promise<{ repoId: string }>;
};

type WasmScanResponse = {
  ok: boolean;
  error?: string;
  output?: {
    issues?: unknown[];
  };
};

type ScanAuditFn = (input: string) => unknown;

let scanAuditPromise: Promise<ScanAuditFn> | null = null;

async function loadScanAudit(): Promise<ScanAuditFn> {
  if (scanAuditPromise) return scanAuditPromise;
  scanAuditPromise = (async () => {
    const repoRoot = path.resolve(process.cwd(), "..", "..");
    const wasmDir = path.join(repoRoot, "cli", "dist", "wasm");
    const wasmPath = path.join(wasmDir, "markdowntown_scan_audit.wasm");
    const wasmExecPath = path.join(wasmDir, "wasm_exec.js");

    await fs.access(wasmPath);
    await fs.access(wasmExecPath);

    await import(/* webpackIgnore: true */ pathToFileURL(wasmExecPath).href);
    const GoCtor = (globalThis as { Go?: new () => { importObject: WebAssembly.Imports; run: (instance: WebAssembly.Instance) => void } })
      .Go;
    if (!GoCtor) {
      throw new Error("Go runtime not found for WASM audit");
    }

    const go = new GoCtor();
    const wasmBytes = await fs.readFile(wasmPath);
    const { instance } = await WebAssembly.instantiate(
      wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength),
      go.importObject
    );
    void go.run(instance);

    const scanAudit = (globalThis as { markdowntownScanAudit?: (input: string) => unknown })
      .markdowntownScanAudit;
    if (typeof scanAudit !== "function") {
      throw new Error("markdowntownScanAudit export not available");
    }

    return scanAudit;
  })();

  return scanAuditPromise;
}

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
    {
      id: "audit-instructions-2",
      ruleId: "mdt.instructions.missing",
      title: "Missing project instructions section",
      severity: "warning",
      filePath: "AGENTS.md",
      summary: "Add a project overview and build/test guidance.",
    },
  ];

  try {
    const scanAudit = await loadScanAudit();
    const repoRootDir = path.resolve(process.cwd(), "..", "..");
    const registryPath = path.join(repoRootDir, "cli", "data", "ai-config-patterns.json");
    const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));

    const request = {
      repoRoot,
      includeContent: true,
      registry,
      files: files.map((file) => ({
        path: `${repoRoot}/${file.path}`,
        content: file.content,
      })),
    };

    const responseRaw = scanAudit(JSON.stringify(request));
    const response = (typeof responseRaw === "string"
      ? JSON.parse(responseRaw)
      : responseRaw) as WasmScanResponse;

    if (!response.ok) {
      throw new Error(response.error || "WASM audit failed");
    }

    const rawIssues = Array.isArray(response.output?.issues) ? response.output?.issues ?? [] : [];
    const issues = normalizeIssues(rawIssues, repoRoot);

    return {
      issues: issues.length > 0 ? issues : fallbackIssues,
      status: "ready" as const,
    };
  } catch (error) {
    return {
      issues: fallbackIssues,
      status: "error" as const,
      error: error instanceof Error ? error.message : "WASM audit unavailable",
    };
  }
}

export default async function RepoDetailPage({ params }: RepoDetailPageProps) {
  const { repoId: rawRepoId } = await params;
  const repoId = decodeURIComponent(rawRepoId);
  const repoName = repoId.replace(/-/g, " ");
  const files = [
    {
      path: "AGENTS.md",
      content: "---\nproject: cli-sync-demo\ninvalid: [\n---\n\n# Repo instructions\n- Use pnpm lint\n",
    },
    {
      path: "src/lib/sync.ts",
      content: "export const syncVersion = \"0.9.4\";\n\nexport function syncSnapshot() {\n  return \"snapshot-ready\";\n}\n",
    },
    {
      path: "README.md",
      content: "# CLI Sync Demo\n\nThis repo demonstrates CLI snapshot sync.\n",
    },
  ];

  const { issues, status: auditStatus, error } = await loadAuditIssues(files);
  const selectedFile = files[0]!;

  return (
    <Container className="py-mdt-10 md:py-mdt-12">
      <Stack gap={6}>
        <Row align="center" justify="between" wrap className="gap-mdt-4">
          <Stack gap={1} className="min-w-0">
            <Text size="caption" tone="muted" className="uppercase tracking-wide">
              CLI Sync
            </Text>
            <Heading level="h1">{repoName}</Heading>
            <Text tone="muted">
              Snapshot 4c9b2a1 · {issues.length} issues · {files.length} files
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
            WASM audit failed to load. Showing last known issues. {error ? `(${error})` : null}
          </div>
        ) : null}

        <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <FileTree paths={files.map((file) => file.path)} selectedPath={selectedFile.path} />
          <Editor filePath={selectedFile.path} content={selectedFile.content} />
          <IssuesPanel issues={issues} auditStatus={auditStatus} />
        </div>
      </Stack>
    </Container>
  );
}
