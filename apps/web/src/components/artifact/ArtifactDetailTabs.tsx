"use client";

import React from "react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Button } from "@/components/ui/Button";
import { FileTree } from "@/components/ui/FileTree";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/Tabs";
import { lintUamV1 } from "@/lib/uam/uamLint";
import { safeParseUamV1 } from "@/lib/uam/uamValidate";
import type { UamScopeV1 } from "@/lib/uam/uamTypes";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => <div>Loading...</div>,
});

type CompileResult = {
  files: Array<{ path: string; content: string }>;
  warnings: string[];
  info?: string[];
};

type VersionRow = {
  id: string;
  version: string;
  message: string | null;
  createdAt: string;
};

type VersionDetail = VersionRow & {
  uam: unknown;
  compiled?: unknown | null;
  lint?: unknown | null;
};

export type ArtifactDetailTabsProps = {
  artifactId: string;
  version: string;
  uam: unknown;
  targets: string[];
  lintGrade: string | null;
  onVersionChange?: (payload: { version: string; uam: unknown; targets: string[] }) => void;
};

function scopeLabel(scope: UamScopeV1): string {
  if (scope.name && scope.name.trim().length > 0) return scope.name;
  if (scope.kind === "global") return "Global";
  if (scope.kind === "dir") return scope.dir;
  return scope.patterns.join(", ");
}

function blockLabel(block: { kind: string; title?: string }) {
  const title = block.title?.trim();
  if (title && title.length > 0) return title;
  return block.kind.toUpperCase();
}

function renderScopeMarkdown(scope: UamScopeV1, blocks: Array<{ kind: string; title?: string; body: string }>): string {
  const header = scope.kind === "global" ? "## Global" : `## ${scopeLabel(scope)}`;

  if (blocks.length === 0) return `${header}\n\n_(no blocks)_`;

  const renderedBlocks = blocks.map((b) => {
    const title = blockLabel(b);
    const body = b.body.trimEnd();
    return `### ${title}\n\n${body.length > 0 ? body : "_(empty)_"}`;
  });

  return `${header}\n\n${renderedBlocks.join("\n\n---\n\n")}`;
}

function buildRenderedMarkdown(uam: unknown): { markdown: string; ok: boolean } {
  const parsed = safeParseUamV1(uam);
  if (!parsed.success) {
    const raw = typeof uam === "string" ? uam : JSON.stringify(uam, null, 2);
    return { ok: false, markdown: `# Raw\n\n\`\`\`json\n${raw}\n\`\`\`` };
  }

  const data = parsed.data;
  const header = `# ${data.meta.title}${data.meta.description ? `\n\n${data.meta.description}` : ""}`;
  const sections = data.scopes.map((scope) => {
    const scoped = data.blocks.filter((b) => b.scopeId === scope.id);
    return renderScopeMarkdown(scope, scoped);
  });
  return { ok: true, markdown: `${header}\n\n${sections.join("\n\n---\n\n")}`.trimEnd() };
}

function storageKey(artifactId: string, version: string) {
  return `artifact-compile:${artifactId}:${version}`;
}

function safeParseCompileResult(raw: string | null): CompileResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CompileResult;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function targetIdsFromUam(uam: unknown, fallback: string[]): string[] {
  const parsed = safeParseUamV1(uam);
  if (!parsed.success) return fallback;
  const ids = parsed.data.targets.map(t => t.targetId).filter(Boolean);
  return ids.length > 0 ? ids : fallback;
}

type DiffChunk = { type: "equal" | "add" | "del"; lines: string[] };

function diffLines(before: string, after: string): DiffChunk[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  const maxCells = 400_000;
  const cells = (beforeLines.length + 1) * (afterLines.length + 1);
  if (cells > maxCells) {
    return [{ type: "equal", lines: ["(Diff too large to render.)"] }];
  }

  const width = afterLines.length + 1;
  const dp = new Uint16Array(cells);

  for (let i = beforeLines.length - 1; i >= 0; i--) {
    for (let j = afterLines.length - 1; j >= 0; j--) {
      const idx = i * width + j;
      if (beforeLines[i] === afterLines[j]) {
        dp[idx] = (dp[(i + 1) * width + (j + 1)] ?? 0) + 1;
      } else {
        const down = dp[(i + 1) * width + j] ?? 0;
        const right = dp[i * width + (j + 1)] ?? 0;
        dp[idx] = down >= right ? down : right;
      }
    }
  }

  const chunks: DiffChunk[] = [];
  const push = (type: DiffChunk["type"], line: string) => {
    const last = chunks[chunks.length - 1];
    if (last && last.type === type) {
      last.lines.push(line);
    } else {
      chunks.push({ type, lines: [line] });
    }
  };

  let i = 0;
  let j = 0;
  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) {
      push("equal", beforeLines[i]!);
      i++;
      j++;
      continue;
    }

    const down = dp[(i + 1) * width + j] ?? 0;
    const right = dp[i * width + (j + 1)] ?? 0;
    if (down >= right) {
      push("del", beforeLines[i]!);
      i++;
    } else {
      push("add", afterLines[j]!);
      j++;
    }
  }

  while (i < beforeLines.length) {
    push("del", beforeLines[i]!);
    i++;
  }
  while (j < afterLines.length) {
    push("add", afterLines[j]!);
    j++;
  }

  return chunks;
}

export function ArtifactDetailTabs({ artifactId, version, uam, targets, lintGrade, onVersionChange }: ArtifactDetailTabsProps) {
  const [tab, setTab] = React.useState<"rendered" | "raw" | "files" | "lint" | "versions" | "diff">("rendered");

  const [compileResult, setCompileResult] = React.useState<CompileResult | null>(null);
  const [compileLoading, setCompileLoading] = React.useState(false);
  const [compileError, setCompileError] = React.useState<string | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);

  const [versions, setVersions] = React.useState<VersionRow[] | null>(null);
  const [versionsLoading, setVersionsLoading] = React.useState(false);
  const [versionsError, setVersionsError] = React.useState<string | null>(null);

  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null);
  const [selectLoading, setSelectLoading] = React.useState(false);
  const [selectError, setSelectError] = React.useState<string | null>(null);

  const [activeVersion, setActiveVersion] = React.useState(version);
  const [activeUam, setActiveUam] = React.useState(uam);

  const versionCacheRef = React.useRef(new Map<string, VersionDetail>());

  React.useEffect(() => {
    versionCacheRef.current.clear();
  }, [artifactId]);

  React.useEffect(() => {
    setActiveVersion(version);
    setActiveUam(uam);
  }, [uam, version]);

  const activeTargets = React.useMemo(() => targetIdsFromUam(activeUam, targets), [activeUam, targets]);

  const { markdown, ok: renderOk } = React.useMemo(() => buildRenderedMarkdown(activeUam), [activeUam]);

  React.useEffect(() => {
    const cached = safeParseCompileResult(sessionStorage.getItem(storageKey(artifactId, activeVersion)));
    setCompileResult(cached);
    setSelectedPath(cached?.files[0]?.path ?? null);
    setCompileError(null);
  }, [artifactId, activeVersion]);

  const compileNow = async () => {
    try {
      setCompileError(null);
      setCompileLoading(true);

      const parsed = safeParseUamV1(activeUam);
      const payloadTargets =
        parsed.success && parsed.data.targets.length > 0
          ? undefined
          : activeTargets.length > 0
            ? activeTargets.map((targetId) => ({ targetId }))
            : undefined;
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadTargets ? { uam: activeUam, targets: payloadTargets } : { uam: activeUam }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error ?? `Compilation failed (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as CompileResult;
      setCompileResult(data);
      setSelectedPath(data.files[0]?.path ?? null);
      sessionStorage.setItem(storageKey(artifactId, activeVersion), JSON.stringify(data));
    } catch (err: unknown) {
      setCompileError(err instanceof Error ? err.message : "Compile failed");
    } finally {
      setCompileLoading(false);
    }
  };

  const files = compileResult?.files ?? [];
  const selectedFile = selectedPath ? files.find((f) => f.path === selectedPath) ?? null : null;

  React.useEffect(() => {
    if (tab !== "versions" && tab !== "diff") return;
    if (versionsLoading || versions) return;

    void (async () => {
      try {
        setVersionsError(null);
        setVersionsLoading(true);

        const res = await fetch(`/api/artifacts/${artifactId}/versions`);
        if (!res.ok) throw new Error(`Failed to load versions (${res.status})`);

        const data = (await res.json()) as { versions?: VersionRow[] };
        setVersions(data.versions ?? []);
      } catch (err: unknown) {
        setVersionsError(err instanceof Error ? err.message : "Failed to load versions");
      } finally {
        setVersionsLoading(false);
      }
    })();
  }, [artifactId, tab, versions, versionsLoading]);

  React.useEffect(() => {
    if (!versions || versions.length === 0) return;
    if (selectedVersionId && versions.some(v => v.id === selectedVersionId)) return;
    const match = versions.find(v => v.version === activeVersion);
    if (match) setSelectedVersionId(match.id);
  }, [activeVersion, selectedVersionId, versions]);

  const fetchVersionDetail = React.useCallback(
    async (versionId: string): Promise<VersionDetail> => {
      const cached = versionCacheRef.current.get(versionId);
      if (cached) return cached;

      const res = await fetch(`/api/artifacts/${artifactId}/versions?versionId=${encodeURIComponent(versionId)}`);
      if (!res.ok) throw new Error(`Failed to load version (${res.status})`);

      const data = (await res.json()) as { version?: VersionDetail };
      if (!data.version) throw new Error("Missing version payload");

      versionCacheRef.current.set(versionId, data.version);
      return data.version;
    },
    [artifactId]
  );

  const selectVersion = (versionId: string) => {
    void (async () => {
      try {
        setSelectError(null);
        setSelectLoading(true);

        const detail = await fetchVersionDetail(versionId);
        setSelectedVersionId(detail.id);
        setActiveVersion(detail.version);
        setActiveUam(detail.uam);

        onVersionChange?.({
          version: detail.version,
          uam: detail.uam,
          targets: targetIdsFromUam(detail.uam, targets),
        });
      } catch (err: unknown) {
        setSelectError(err instanceof Error ? err.message : "Failed to load version");
      } finally {
        setSelectLoading(false);
      }
    })();
  };

  const lintWarnings = React.useMemo(() => {
    const parsed = safeParseUamV1(activeUam);
    if (!parsed.success) return null;
    return lintUamV1(parsed.data);
  }, [activeUam]);

  const selectedRow = React.useMemo(() => {
    if (!versions || versions.length === 0) return null;
    const byId = selectedVersionId ? versions.find(v => v.id === selectedVersionId) : null;
    if (byId) return byId;
    return versions.find(v => v.version === activeVersion) ?? versions[0] ?? null;
  }, [activeVersion, selectedVersionId, versions]);

  const previousRow = React.useMemo(() => {
    if (!versions || !selectedRow) return null;
    const idx = versions.findIndex(v => v.id === selectedRow.id);
    if (idx === -1) return null;
    return versions[idx + 1] ?? null;
  }, [selectedRow, versions]);

  const [diffBase, setDiffBase] = React.useState<VersionDetail | null>(null);
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [diffError, setDiffError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (tab !== "diff") return;
    if (!previousRow) {
      setDiffBase(null);
      setDiffError(null);
      return;
    }

    void (async () => {
      try {
        setDiffError(null);
        setDiffLoading(true);
        const detail = await fetchVersionDetail(previousRow.id);
        setDiffBase(detail);
      } catch (err: unknown) {
        setDiffBase(null);
        setDiffError(err instanceof Error ? err.message : "Failed to load diff");
      } finally {
        setDiffLoading(false);
      }
    })();
  }, [fetchVersionDetail, previousRow, tab]);

  const diffChunks = React.useMemo(() => {
    if (!diffBase) return null;
    const before = JSON.stringify(diffBase.uam, null, 2);
    const after = JSON.stringify(activeUam, null, 2);
    return diffLines(before, after);
  }, [activeUam, diffBase]);

  return (
    <TabsRoot value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="rendered">
          Rendered
        </TabsTrigger>
        <TabsTrigger value="raw">
          Raw
        </TabsTrigger>
        <TabsTrigger value="files">
          Files
        </TabsTrigger>
        <TabsTrigger value="lint">
          Lint
        </TabsTrigger>
        <TabsTrigger value="diff">
          Diff
        </TabsTrigger>
        <TabsTrigger value="versions">
          Versions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rendered">
        {!renderOk && <div className="text-xs text-mdt-muted mb-3">This artifact does not validate as UAM v1.</div>}
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {markdown}
          </ReactMarkdown>
        </div>
      </TabsContent>

      <TabsContent value="raw">
        <pre className="text-xs overflow-auto whitespace-pre-wrap font-mono text-mdt-text">
          {JSON.stringify(activeUam, null, 2)}
        </pre>
      </TabsContent>

      <TabsContent value="files">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-mdt-muted">
              {activeTargets.length > 0 ? `Targets: ${activeTargets.join(", ")}` : "Targets: none"}
            </div>
            <Button size="sm" variant="secondary" onClick={compileNow} disabled={compileLoading}>
              {compileLoading ? "Compiling…" : compileResult ? "Recompile" : "Compile"}
            </Button>
          </div>

          {compileError && <div className="text-xs text-mdt-danger">{compileError}</div>}

          {compileResult && (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-mdt-muted uppercase tracking-wide mb-2">Manifest</div>
                <FileTree
                  paths={files.map((f) => f.path)}
                  selectedPath={selectedPath}
                  onSelect={(path) => setSelectedPath(path)}
                  emptyLabel="No files generated."
                />
              </div>

              <div className="min-w-0">
                {selectedFile ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-mdt-border">
                      <div className="font-mono text-xs text-mdt-text">{selectedFile.path}</div>
                      <div className="flex items-center gap-2">
                        {copiedPath === selectedFile.path && <div className="text-[11px] text-mdt-muted">Copied</div>}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selectedFile.content);
                              setCopiedPath(selectedFile.path);
                              setTimeout(() => setCopiedPath(null), 1000);
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    <pre className="text-xs overflow-auto p-3 font-mono whitespace-pre-wrap">{selectedFile.content}</pre>
                  </div>
                ) : (
                  <div className="text-body-sm text-mdt-muted">Select a file to view its contents.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="lint">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-body-sm text-mdt-text">
              Stored lint grade: <span className="font-semibold">{lintGrade ?? "—"}</span>
            </div>
            <div className="text-body-sm text-mdt-text">
              UAM lint warnings: <span className="font-semibold">{lintWarnings ? lintWarnings.length : "—"}</span>
            </div>
          </div>

          {lintWarnings === null && (
            <div className="text-body-sm text-mdt-muted">This version does not validate as UAM v1.</div>
          )}

          {lintWarnings && lintWarnings.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-mdt-text space-y-1">
              {lintWarnings.map((w, i) => (
                <li key={i}>
                  <span className="font-semibold">{w.code}</span>: {w.message}
                </li>
              ))}
            </ul>
          )}

          {compileResult?.warnings && compileResult.warnings.length > 0 ? (
            <div className="p-3 bg-mdt-accent-soft border border-mdt-border rounded-mdt-md">
              <div className="text-xs font-semibold text-mdt-text mb-2">Compile warnings</div>
              <ul className="list-disc pl-5 text-xs text-mdt-text space-y-1">
                {compileResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-body-sm text-mdt-muted">No compile warnings.</div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="diff">
        <div className="space-y-3">
          {versionsLoading && <div className="text-body-sm text-mdt-muted">Loading versions…</div>}
          {versionsError && <div className="text-body-sm text-mdt-danger">{versionsError}</div>}

          {!versionsLoading && versions && versions.length > 0 && !previousRow && (
            <div className="text-body-sm text-mdt-muted">No previous version to diff against.</div>
          )}

          {diffLoading && <div className="text-body-sm text-mdt-muted">Loading diff…</div>}
          {diffError && <div className="text-body-sm text-mdt-danger">{diffError}</div>}

          {diffChunks && (
            <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle overflow-hidden">
              <div className="px-3 py-2 border-b border-mdt-border text-caption text-mdt-muted">
                {previousRow ? `Comparing v${previousRow.version} → v${selectedRow?.version ?? activeVersion}` : "Diff"}
              </div>
              <pre className="text-xs overflow-auto whitespace-pre font-mono text-mdt-text p-3">
                {diffChunks.map((chunk, chunkIdx) =>
                  chunk.lines.map((line, lineIdx) => {
                    const prefix = chunk.type === "add" ? "+ " : chunk.type === "del" ? "- " : "  ";
                    const cls =
                      chunk.type === "add"
                        ? "text-[color:var(--mdt-color-success)]"
                        : chunk.type === "del"
                          ? "text-[color:var(--mdt-color-danger)]"
                          : "text-mdt-text";
                    return (
                      <span key={`${chunkIdx}-${lineIdx}`} className={cls}>
                        {prefix}
                        {line}
                        {"\n"}
                      </span>
                    );
                  })
                )}
              </pre>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="versions">
        <div className="space-y-3">
          {versionsLoading && <div className="text-body-sm text-mdt-muted">Loading…</div>}
          {versionsError && <div className="text-body-sm text-mdt-danger">{versionsError}</div>}
          {selectLoading && <div className="text-body-sm text-mdt-muted">Loading version…</div>}
          {selectError && <div className="text-body-sm text-mdt-danger">{selectError}</div>}

          {versions && versions.length === 0 && <div className="text-body-sm text-mdt-muted">No versions yet.</div>}

          {versions && versions.length > 0 && (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => selectVersion(v.id)}
                    disabled={selectLoading}
                    aria-label={`Select version ${v.version}`}
                    className={[
                      "w-full text-left rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-3",
                      "hover:bg-[color:var(--mdt-color-surface-strong)]",
                      v.id === selectedRow?.id ? "ring-2 ring-[color:var(--mdt-color-primary-strong)]" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-caption text-mdt-text">v{v.version}</div>
                        {v.id === selectedRow?.id && <div className="text-caption text-mdt-muted">(selected)</div>}
                      </div>
                      <div className="text-caption text-mdt-muted">{new Date(v.createdAt).toLocaleString()}</div>
                    </div>
                    {v.message && <div className="text-body-sm text-mdt-text mt-1">{v.message}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TabsContent>
    </TabsRoot>
  );
}
