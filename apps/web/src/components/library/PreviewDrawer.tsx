"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FileTree } from "@/components/ui/FileTree";
import { Text } from "@/components/ui/Text";
import { Drawer, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/Drawer";
import { trackLibraryAction } from "@/lib/analytics";

type CompileResult = {
  files: Array<{ path: string; content: string }>;
  warnings: string[];
  info?: string[];
};

type ArtifactDetailResponse = {
  artifact: { id: string; slug: string | null; targets: string[] };
  latestVersion: { uam: unknown; version: string } | null;
};

export type PreviewDrawerProps = {
  artifactId: string;
  title: string;
  targets: string[];
};

function defaultTargetId(targets: string[]): string | null {
  if (targets.length === 0) return null;
  const preferred = targets.find((t) => t === "agents-md");
  return preferred ?? targets[0] ?? null;
}

function defaultPath(files: Array<{ path: string }>): string | null {
  const preferred = files.find((f) => f.path.toLowerCase() === "agents.md")?.path;
  if (preferred) return preferred;
  const firstMarkdown = files.find((f) => f.path.toLowerCase().endsWith(".md"))?.path;
  return firstMarkdown ?? files[0]?.path ?? null;
}

export function PreviewDrawer({ artifactId, title, targets }: PreviewDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [compileResult, setCompileResult] = React.useState<CompileResult | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);

  const inFlight = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    if (compileResult) return;
    if (inFlight.current) return;

    let cancelled = false;
    inFlight.current = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        const detailRes = await fetch(`/api/artifacts/${artifactId}`);
        if (!detailRes.ok) {
          throw new Error(`Failed to load artifact (${detailRes.status})`);
        }
        const detail = (await detailRes.json()) as ArtifactDetailResponse;
        const uam = detail.latestVersion?.uam;
        if (!uam) throw new Error("Artifact has no versions yet.");

        const effectiveTargets = detail.artifact?.targets?.length ? detail.artifact.targets : targets;
        const preferredTargetId = defaultTargetId(effectiveTargets);
        const compileTargets = preferredTargetId ? [{ targetId: preferredTargetId }] : undefined;

        const compileRes = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uam, targets: compileTargets }),
        });
        if (!compileRes.ok) {
          const body = await compileRes.json().catch(() => null);
          const message = body?.error ?? `Compilation failed (${compileRes.status})`;
          throw new Error(message);
        }

        const compiled = (await compileRes.json()) as CompileResult;
        if (cancelled) return;
        setCompileResult(compiled);
        setSelectedPath(defaultPath(compiled.files));
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      inFlight.current = false;
    };
  }, [artifactId, compileResult, open, targets]);

  const selectedFile = React.useMemo(() => {
    if (!compileResult || !selectedPath) return null;
    return compileResult.files.find((f) => f.path === selectedPath) ?? null;
  }, [compileResult, selectedPath]);

  const manifestPaths = React.useMemo(() => compileResult?.files.map((f) => f.path) ?? [], [compileResult]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="ghost">
          Preview
        </Button>
      </DrawerTrigger>

      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle className="text-h3">Preview</DrawerTitle>
            <div className="mt-1 text-body-sm text-mdt-muted truncate">{title}</div>
            <Text size="bodySm" tone="muted" className="mt-2">
              This preview shows what will load in Workbench. Open in Workbench to export agents.md.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" asChild>
              <Link
                href={`/workbench?id=${artifactId}`}
                onClick={() =>
                  trackLibraryAction({
                    action: "open_workbench",
                    id: artifactId,
                    title,
                    source: "library_preview",
                  })
                }
              >
                Open in Workbench
              </Link>
            </Button>
            <DrawerCloseButton />
          </div>
        </DrawerHeader>

        <div className="flex-1 space-y-mdt-5 overflow-auto px-mdt-5 py-mdt-6">
          {loading && (
            <Text tone="muted" size="bodySm">
              Loading preview…
            </Text>
          )}
          {error && (
            <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-4 text-body-sm text-mdt-danger">
              {error}
            </div>
          )}

          {!loading && !error && compileResult && (
            <>
              <div className="space-y-mdt-2">
                <Text size="caption" tone="muted">
                  Manifest
                </Text>
                <FileTree
                  paths={manifestPaths}
                  selectedPath={selectedPath}
                  onSelect={(path) => setSelectedPath(path)}
                  emptyLabel="No files generated."
                />
              </div>

              <div className="space-y-mdt-2">
                <Text size="caption" tone="muted">
                  Raw markdown
                </Text>
                <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle shadow-mdt-sm">
                  <div className="border-b border-mdt-border bg-mdt-surface px-3 py-2 text-xs font-mono text-mdt-text">
                    {selectedFile?.path ?? "Select a file"}
                  </div>
                  <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap p-3 text-xs font-mono text-mdt-text">
                    {selectedFile?.content ?? ""}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
