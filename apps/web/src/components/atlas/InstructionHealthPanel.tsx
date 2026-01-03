"use client";

import { CopyButton } from "@/components/atlas/CopyButton";
import { PathChip } from "@/components/atlas/PathChip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { track } from "@/lib/analytics";
import { INSTRUCTION_TEMPLATES, type InstructionTemplate } from "@/lib/atlas/simulators/templates";
import type { InstructionDiagnostic, InstructionDiagnostics, SimulatorToolId } from "@/lib/atlas/simulators/types";
import Link from "next/link";

const severityOrder: Record<InstructionDiagnostic["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const severityTone: Record<InstructionDiagnostic["severity"], "danger" | "warning" | "info"> = {
  error: "danger",
  warning: "warning",
  info: "info",
};

const severityLabel: Record<InstructionDiagnostic["severity"], string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};
type InstructionHealthPanelProps = {
  diagnostics: InstructionDiagnostics;
  copySummaryText?: string;
  workbenchHref?: string;
};

function buildSummaryCounts(diagnostics: InstructionDiagnostic[]) {
  return diagnostics.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

function resolveTemplate(tool: SimulatorToolId, diagnostic: InstructionDiagnostic): InstructionTemplate | null {
  const templates = INSTRUCTION_TEMPLATES[tool];
  if (!templates) return null;

  if (diagnostic.code.startsWith("missing.agents") || diagnostic.code === "override-without-base") {
    return templates.root;
  }
  if (diagnostic.code.startsWith("missing.claude") || diagnostic.code.startsWith("missing.gemini")) {
    return templates.root;
  }
  if (diagnostic.code === "missing.copilot-cli" || diagnostic.code === "missing.github-copilot") {
    return templates.root;
  }
  if (
    diagnostic.code === "wrong-extension.copilot-cli" ||
    diagnostic.code === "wrong-folder.copilot-cli" ||
    diagnostic.code === "wrong-folder.github-copilot"
  ) {
    return templates.scoped;
  }
  return null;
}

function shouldSuggestWorkbench(diagnostic: InstructionDiagnostic): boolean {
  return diagnostic.code.startsWith("missing.");
}

export function InstructionHealthPanel({ diagnostics, copySummaryText, workbenchHref }: InstructionHealthPanelProps) {
  const sortedDiagnostics = [...diagnostics.diagnostics].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
  const counts = buildSummaryCounts(sortedDiagnostics);
  const statusLabel = counts.error > 0 ? "Fail" : counts.warning > 0 ? "Warn" : "Pass";
  const statusTone = counts.error > 0 ? "danger" : counts.warning > 0 ? "warning" : "success";
  const summaryParts = [
    `${counts.error} error${counts.error === 1 ? "" : "s"}`,
    `${counts.warning} warning${counts.warning === 1 ? "" : "s"}`,
  ];
  if (counts.info > 0) {
    summaryParts.push(`${counts.info} note${counts.info === 1 ? "" : "s"}`);
  }

  return (
    <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
      <Stack gap={3}>
        <div className="flex flex-wrap items-start justify-between gap-mdt-3">
          <div className="space-y-mdt-1">
            <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              Instruction health
            </Text>
            <Text size="bodySm" tone="muted">
              Validates file placement for the selected tool. Local-only.
            </Text>
          </div>
          {copySummaryText ? (
            <CopyButton text={copySummaryText} label="Copy fix summary" copiedLabel="Fix summary copied" size="xs" variant="secondary" />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-mdt-2">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <Text size="bodySm" tone="muted">
            {summaryParts.join(" / ")}
          </Text>
        </div>

        {sortedDiagnostics.length === 0 ? (
          <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text size="bodySm" weight="semibold">
              Everything looks good
            </Text>
            <Text size="bodySm" tone="muted">
              No placement issues detected for this tool.
            </Text>
            <Text size="bodySm" tone="muted">
              You can move on to Workbench or export a report.
            </Text>
          </div>
        ) : (
          <ul className="space-y-mdt-2" aria-label="Instruction health issues">
            {sortedDiagnostics.map((item, index) => {
              const template = resolveTemplate(diagnostics.tool, item);
              const suggestion = item.suggestion ?? (item.expectedPath ? `Expected path: ${item.expectedPath}` : null);
              const examplePath = item.expectedPath ?? template?.path ?? null;
              const showWorkbench = shouldSuggestWorkbench(item);
              const isMissing = item.code.startsWith("missing.") || item.code === "override-without-base";
              return (
                <li
                  key={`${item.code}-${index}`}
                  className={`rounded-mdt-md border px-mdt-3 py-mdt-2 ${
                    isMissing ? "border-mdt-border-strong bg-mdt-surface-raised" : "border-mdt-border bg-mdt-surface"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-mdt-2">
                    <Badge tone={severityTone[item.severity]}>{severityLabel[item.severity]}</Badge>
                    {isMissing ? <Badge tone="warning">Missing file</Badge> : null}
                    <Text size="bodySm" weight="semibold">
                      {item.message}
                    </Text>
                  </div>
                  {suggestion ? (
                    <Text size="bodySm" tone="muted" className="mt-mdt-1">
                      {suggestion}
                    </Text>
                  ) : null}
                  {template || examplePath || showWorkbench ? (
                    <div className="mt-mdt-2 flex flex-wrap items-center gap-mdt-2">
                      {template ? (
                        <CopyButton
                          text={template.content}
                          label="Copy template"
                          copiedLabel="Template copied"
                          variant="secondary"
                          size="xs"
                          aria-label={`Copy ${template.label}`}
                          onCopy={() =>
                            track("atlas_simulator_health_template_copy", {
                              tool: diagnostics.tool,
                              code: item.code,
                              templateId: template.id,
                              templatePath: template.path,
                            })
                          }
                        />
                      ) : null}
                      {showWorkbench ? (
                        <Button asChild variant="secondary" size="xs">
                          <Link href={workbenchHref ?? "/workbench"}>Open Workbench</Link>
                        </Button>
                      ) : null}
                      {examplePath ? <PathChip path={examplePath} /> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Stack>
    </div>
  );
}
