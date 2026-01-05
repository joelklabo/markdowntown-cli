import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { loadEngineWasm } from "@/lib/engine/wasmLoader";

type NormalizedPath = {
  path: string;
  scope?: string;
  redacted?: boolean;
};

type NormalizedIssue = {
  ruleId: string;
  severity: string;
  title?: string;
  message?: string;
  suggestion?: string;
  fingerprint?: string;
  range?: {
    startLine?: number;
    startCol?: number;
    endLine?: number;
    endCol?: number;
  };
  paths: NormalizedPath[];
  tools: Array<{ toolId: string; kind: string }>;
  evidence?: unknown;
  data?: unknown;
};

type FixtureFile = {
  path: string;
  content: string;
};

const REPO_ROOT = "/repo";

test(
  "WASM engine matches CLI audit fixtures",
  async () => {
    const engine = await loadEngineWasm();

    const registryPath = resolveFixturePath("registry", "cli/data/ai-config-patterns.json");
    const registry = JSON.parse(await fsp.readFile(registryPath, "utf8"));

    const repoPath = resolveFixturePath("fixture repo", "cli/testdata/fixtures/engine-wasm/repo");
    const expectedIssuesPath = resolveFixturePath("expected issues", "cli/testdata/fixtures/engine-wasm/expected-issues.json");

    const files = await readFilesRecursive(repoPath);
    const response = engine.runScanAudit({
      repoRoot: REPO_ROOT,
      includeContent: true,
      registry,
      files: files.map((file) => ({ path: file.path, content: file.content })),
    });

    if (!response.ok) {
      throw new Error(response.error ?? "WASM engine returned an error");
    }

    const actualIssues = normalizeIssues(response.output?.issues ?? [], REPO_ROOT);
    const expectedIssuesRaw = JSON.parse(await fsp.readFile(expectedIssuesPath, "utf8"));
    const expectedIssues = normalizeIssues(expectedIssuesRaw, REPO_ROOT);

    expect(actualIssues).toEqual(expectedIssues);
  },
  30000
);

async function readFilesRecursive(dir: string, root = dir): Promise<FixtureFile[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const results: FixtureFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await readFilesRecursive(fullPath, root)));
      continue;
    }
    const content = await fsp.readFile(fullPath, "utf8");
    const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
    results.push({ path: relativePath, content });
  }

  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

function normalizeIssues(rawIssues: any[], repoRoot: string): NormalizedIssue[] {
  const normalizePath = (value: string): string => {
    const normalized = value.replace(/\\/g, "/");
    const withoutRoot = normalized.startsWith(repoRoot) ? normalized.slice(repoRoot.length) : normalized;
    const trimmed = withoutRoot.replace(/^\/+/, "");
    if (trimmed.startsWith("./")) {
      return trimmed;
    }
    return `./${trimmed}`;
  };

  const normalizePaths = (paths: any[]): NormalizedPath[] =>
    (paths ?? [])
      .map((entry) => ({
        path: normalizePath(String(entry?.path ?? "")),
        scope: entry?.scope ? String(entry.scope) : undefined,
        redacted: entry?.redacted ?? false,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));

  const normalizeTools = (tools: any[]): Array<{ toolId: string; kind: string }> =>
    (tools ?? [])
      .map((tool) => ({
        toolId: String(tool?.toolId ?? ""),
        kind: String(tool?.kind ?? ""),
      }))
      .sort((left, right) => {
        if (left.toolId !== right.toolId) {
          return left.toolId.localeCompare(right.toolId);
        }
        return left.kind.localeCompare(right.kind);
      });

  const issues = (rawIssues ?? []).map<NormalizedIssue>((issue) => ({
    ruleId: String(issue?.ruleId ?? issue?.ruleID ?? ""),
    severity: String(issue?.severity ?? ""),
    title: issue?.title ? String(issue.title) : undefined,
    message: issue?.message ? String(issue.message) : undefined,
    suggestion: issue?.suggestion ? String(issue.suggestion) : undefined,
    fingerprint: issue?.fingerprint ? String(issue.fingerprint) : undefined,
    range: issue?.range
      ? {
          startLine: issue.range.startLine,
          startCol: issue.range.startCol,
          endLine: issue.range.endLine,
          endCol: issue.range.endCol,
        }
      : undefined,
    paths: normalizePaths(issue?.paths ?? []),
    tools: normalizeTools(issue?.tools ?? []),
    evidence: issue?.evidence,
    data: issue?.data,
  }));

  issues.sort((left, right) => {
    if (left.ruleId !== right.ruleId) {
      return left.ruleId.localeCompare(right.ruleId);
    }
    if ((left.fingerprint ?? "") !== (right.fingerprint ?? "")) {
      return (left.fingerprint ?? "").localeCompare(right.fingerprint ?? "");
    }
    return (left.message ?? "").localeCompare(right.message ?? "");
  });

  return issues;
}

function resolveFixturePath(label: string, relativePath: string): string {
  const roots = [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")];
  for (const root of roots) {
    const candidate = path.resolve(root, relativePath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unable to resolve ${label} at ${relativePath}`);
}
