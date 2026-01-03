import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { SimulatorToolId, ToolRulesMetadataMap } from "@/lib/atlas/simulators/types";

export const SCAN_TREE_VIRTUALIZATION_THRESHOLD = 1000;

export function shouldVirtualizeScanTree(totalFiles: number): boolean {
  return totalFiles >= SCAN_TREE_VIRTUALIZATION_THRESHOLD;
}

type SimulatorScanMetaProps = {
  totalFiles: number;
  matchedFiles: number;
  truncated: boolean;
  rootName?: string;
  tool: SimulatorToolId;
  toolRulesMeta?: ToolRulesMetadataMap;
};

function formatVerifiedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function SimulatorScanMeta({
  totalFiles,
  matchedFiles,
  truncated,
  rootName,
  tool,
  toolRulesMeta,
}: SimulatorScanMetaProps) {
  const matchedLabel = `${matchedFiles} instruction file${matchedFiles === 1 ? "" : "s"} found`;
  const totalLabel = `${totalFiles} total file${totalFiles === 1 ? "" : "s"} scanned`;
  const summary = [matchedLabel, totalLabel];
  const toolMeta = toolRulesMeta?.[tool];
  const verifiedLabel = formatVerifiedDate(toolMeta?.lastVerified);
  const metaParts: ReactNode[] = [];

  if (verifiedLabel) {
    metaParts.push(<span key="verified">Rules verified {verifiedLabel}</span>);
  }
  if (toolMeta?.docUrl) {
    metaParts.push(
      <a
        key="docs"
        href={toolMeta.docUrl}
        className="underline decoration-dotted underline-offset-4 hover:text-mdt-text"
        target="_blank"
        rel="noreferrer"
      >
        Docs
      </a>,
    );
  }

  return (
    <div
      data-testid="scan-meta"
      className="flex flex-wrap items-center gap-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-caption text-mdt-muted"
    >
      {rootName ? <span className="font-mono text-mdt-text">{rootName}</span> : null}
      {rootName ? <span className="text-mdt-muted">: </span> : null}
      <span>{summary.join(" · ")}.</span>
      {metaParts.length ? <span className="text-mdt-muted">·</span> : null}
      {metaParts.map((part, index) => (
        <span key={`meta-${index}`} className="inline-flex items-center gap-1 text-mdt-muted">
          {index > 0 ? <span className="text-mdt-muted">·</span> : null}
          {part}
        </span>
      ))}
      {truncated ? <Badge tone="warning">Scan truncated</Badge> : null}
    </div>
  );
}
