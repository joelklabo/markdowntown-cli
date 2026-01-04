import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";

export type IssueSeverity = "error" | "warning" | "info";

export type CliIssue = {
  id: string;
  ruleId: string;
  title: string;
  severity: IssueSeverity;
  filePath: string;
  summary?: string | null;
};

export type IssuesPanelProps = {
  issues: CliIssue[];
  auditStatus?: "ready" | "pending" | "error";
};

const severityTone: Record<IssueSeverity, { tone: "red" | "yellow" | "blue"; label: string }> = {
  error: { tone: "red", label: "Error" },
  warning: { tone: "yellow", label: "Warning" },
  info: { tone: "blue", label: "Info" },
};

export function IssuesPanel({ issues, auditStatus = "ready" }: IssuesPanelProps) {
  const counts = issues.reduce(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 }
  );

  return (
    <Card padding="lg" tone="raised" className="space-y-mdt-4">
      <Stack gap={1}>
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          Audit issues
        </Text>
        <Row align="center" justify="between" wrap className="gap-mdt-3">
          <Heading level="h3">Findings</Heading>
          <Text size="caption" tone="muted" className={auditStatus === "error" ? "text-mdt-danger" : undefined}>
            {auditStatus === "pending" && "Audit pending"}
            {auditStatus === "ready" && "WASM audit complete"}
            {auditStatus === "error" && "Audit unavailable"}
          </Text>
        </Row>
      </Stack>

      <Row align="center" gap={2} wrap>
        <Pill tone="red">Errors · {counts.error}</Pill>
        <Pill tone="yellow">Warnings · {counts.warning}</Pill>
        <Pill tone="blue">Info · {counts.info}</Pill>
      </Row>

      {issues.length === 0 ? (
        <Text tone="muted">No issues found for this snapshot.</Text>
      ) : (
        <div className="space-y-mdt-3">
          {issues.map((issue) => {
            const severity = severityTone[issue.severity];
            return (
              <div key={issue.id} className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
                <Row align="center" justify="between" className="gap-mdt-2">
                  <div>
                    <Row align="center" gap={2} wrap>
                      <Pill tone={severity.tone}>{severity.label}</Pill>
                      <Text size="caption" tone="muted">
                        {issue.ruleId}
                      </Text>
                    </Row>
                    <Heading level="h3" as="h4" className="mt-mdt-2 text-body font-semibold">
                      {issue.title}
                    </Heading>
                  </div>
                  <Text size="caption" tone="muted">
                    {issue.id}
                  </Text>
                </Row>
                <Text size="caption" tone="muted" className="mt-mdt-2">
                  {issue.filePath}
                </Text>
                {issue.summary ? (
                  <Text size="bodySm" className="mt-mdt-2">
                    {issue.summary}
                  </Text>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
