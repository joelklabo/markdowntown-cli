"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Run } from "@prisma/client";

interface RunResultsProps {
  runs: Run[];
}

interface AuditResult {
  issues: Array<{
    ruleId: string;
    severity: "error" | "warning" | "info";
    title: string;
    message: string;
    suggestion?: string;
    paths?: Array<{ path: string }>;
  }>;
}

export function RunResults({ runs }: RunResultsProps) {
  const auditRun = runs.find((r) => r.type === "AUDIT" && r.status === "SUCCESS");
  const suggestRun = runs.find((r) => r.type === "SUGGEST" && r.status === "SUCCESS");

  if (!auditRun && !suggestRun) return null;

  const auditOutput = auditRun?.output as unknown as AuditResult;
  const issues = auditOutput?.issues || [];

  return (
    <div className="flex flex-col gap-8 mt-8">
      {auditRun && (
        <section className="flex flex-col gap-4">
          <Heading level="h2">Audit Issues</Heading>
          {issues.length === 0 ? (
            <Card padding="md" tone="default" className="border-mdt-success-soft">
              <Text tone="default">No issues found. Your instructions look healthy!</Text>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {issues.map((issue, i) => (
                <Card key={i} padding="md" tone="raised" className="flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Badge tone={issue.severity === "error" ? "danger" : "warning"}>
                        {issue.ruleId}
                      </Badge>
                      <Heading level="h3">{issue.title}</Heading>
                    </div>
                  </div>
                  <Text size="bodySm">{issue.message}</Text>
                  {issue.suggestion && (
                    <Text size="caption" tone="muted" className="italic">
                      Suggestion: {issue.suggestion}
                    </Text>
                  )}
                  {issue.paths && issue.paths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {issue.paths.map((p, j) => (
                        <Badge key={j} tone="neutral" className="font-mono text-[10px]">
                          {p.path}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {suggestRun && (
        <section className="flex flex-col gap-4">
          <Heading level="h2">AI Suggestions</Heading>
          <Card padding="md" tone="raised">
            <Text size="bodySm">Suggestions are not yet formatted for display. View raw output in logs.</Text>
          </Card>
        </section>
      )}
    </div>
  );
}
