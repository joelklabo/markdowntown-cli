"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Row, Stack } from "@/components/ui/Stack";
import { createZip } from "@/lib/compile/zip";
import { ForkButton } from "@/components/artifact/ForkButton";
import { trackLibraryAction } from "@/lib/analytics";

export type ArtifactActionsProps = {
  artifactId: string;
  slug: string;
  uam: unknown;
  targets: string[];
};

export function ArtifactActions({ artifactId, slug, uam, targets }: ArtifactActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      setError(null);
      await navigator.clipboard.writeText(JSON.stringify(uam, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
      trackLibraryAction({
        action: "copy",
        id: artifactId,
        slug,
        source: "artifact_detail",
        targetIds: targets,
      });
    } catch {
      setError("Copy failed");
    }
  };

  const handleExport = async () => {
    try {
      setError(null);
      setExporting(true);

      const payloadTargets = targets.length > 0 ? targets.map((targetId) => ({ targetId })) : undefined;
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uam, targets: payloadTargets }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error ?? `Compilation failed (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { files?: Array<{ path: string; content: string }> };
      const files = data.files ?? [];
      if (files.length === 0) {
        setError("No files generated");
        return;
      }

      const blob = await createZip(files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-outputs.zip`;
      a.click();
      URL.revokeObjectURL(url);
      trackLibraryAction({
        action: "download",
        id: artifactId,
        slug,
        source: "artifact_detail",
        targetIds: targets,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack gap={2} align="end">
      <Row gap={2} align="center" wrap>
        <Button asChild size="sm">
          <Link
            href={`/workbench?id=${artifactId}`}
            onClick={() =>
              trackLibraryAction({
                action: "open_workbench",
                id: artifactId,
                slug,
                source: "artifact_detail",
                targetIds: targets,
              })
            }
          >
            Open in Workbench
          </Link>
        </Button>
        <Button size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export"}
        </Button>
        <ForkButton
          artifactId={artifactId}
          size="sm"
          analytics={{ source: "artifact_detail", slug }}
        />
      </Row>
      {error && <div className="text-xs text-mdt-danger">{error}</div>}
    </Stack>
  );
}
