import { Badge } from "@/components/ui/Badge";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import type { ContentLintIssue, ContentLintResult } from "@/lib/atlas/simulators/contentLint";

const severityTone: Record<ContentLintIssue["severity"], "danger" | "warning" | "info"> = {
  error: "danger",
  warning: "warning",
  info: "info",
};

const severityLabel: Record<ContentLintIssue["severity"], string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};

type InstructionContentLintProps = {
  enabled: boolean;
  result: ContentLintResult | null;
};

function summarizeIssues(issues: ContentLintIssue[]) {
  return issues.reduce(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

export function InstructionContentLint({ enabled, result }: InstructionContentLintProps) {
  const issues = result?.issues ?? [];
  const counts = summarizeIssues(issues);
  const statusLabel = counts.error > 0 ? "Fix needed" : counts.warning > 0 ? "Review" : "Looks good";
  const statusTone = counts.error > 0 ? "danger" : counts.warning > 0 ? "warning" : "success";
  const summaryParts = [
    `${counts.error} error${counts.error === 1 ? "" : "s"}`,
    `${counts.warning} warning${counts.warning === 1 ? "" : "s"}`,
    `${counts.info} note${counts.info === 1 ? "" : "s"}`,
  ];

  return (
    <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
      <Stack gap={3}>
        <div className="space-y-mdt-1">
          <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
            Content lint
          </Text>
          <Text size="bodySm" tone="muted">
            Optionally checks instruction file formatting locally for common issues.
          </Text>
        </div>

        {!enabled ? (
          <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text size="bodySm" weight="semibold">
              Enable content linting to see results
            </Text>
            <Text size="bodySm" tone="muted">
              Turn on content linting in Scan setup (local-only) to analyze instruction content.
            </Text>
          </div>
        ) : !result || (result.checkedFiles === 0 && issues.length === 0) ? (
          <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text size="bodySm" weight="semibold">
              No instruction content available
            </Text>
            <Text size="bodySm" tone="muted">
              Scan a folder with content linting enabled to review instruction files.
            </Text>
          </div>
        ) : (
          <Stack gap={3}>
            <div className="flex flex-wrap items-center gap-mdt-2">
              <Badge tone={statusTone}>{statusLabel}</Badge>
              <Text size="bodySm" tone="muted">
                {summaryParts.join(" / ")}
              </Text>
            </div>
            <Text size="bodySm" tone="muted">
              Checked {result.checkedFiles} file{result.checkedFiles === 1 ? "" : "s"}.
              {result.skippedFiles > 0
                ? ` Skipped ${result.skippedFiles} file${result.skippedFiles === 1 ? "" : "s"}.`
                : ""}
            </Text>

            {issues.length === 0 ? (
              <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                <Text size="bodySm" weight="semibold">
                  No formatting issues detected
                </Text>
                <Text size="bodySm" tone="muted">
                  Instruction files look good based on the current lint rules.
                </Text>
              </div>
            ) : (
              <ul className="space-y-mdt-2" aria-label="Content lint issues">
                {issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2"
                  >
                    <div className="flex flex-wrap items-center gap-mdt-2">
                      <Badge tone={severityTone[issue.severity]}>{severityLabel[issue.severity]}</Badge>
                      <Text size="bodySm" weight="semibold">
                        {issue.message}
                      </Text>
                    </div>
                    <Text size="bodySm" tone="muted" className="mt-mdt-1">
                      {issue.path}
                    </Text>
                    {issue.suggestion ? (
                      <Text size="bodySm" tone="muted" className="mt-mdt-1">
                        {issue.suggestion}
                      </Text>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
}
