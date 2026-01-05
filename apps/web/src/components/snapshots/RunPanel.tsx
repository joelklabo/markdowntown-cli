"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { RunStatusBadge } from "./RunStatusBadge";
import { realtimeClient } from "@/lib/pubsub/client";
import type { Run } from "@prisma/client";

interface RunPanelProps {
  snapshotId: string;
  initialRuns: Run[];
}

export function RunPanel({ snapshotId, initialRuns }: RunPanelProps) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [isStarting, setIsStarting] = useState<string | null>(null);

  useEffect(() => {
    return realtimeClient.subscribe((event) => {
      if (event.snapshotId === snapshotId) {
        setRuns((prev) => {
          const match = prev.find((r) => r.id === event.runId);
          if (match) {
            return prev.map((r) =>
              r.id === event.runId
                ? ({ ...r, status: event.status } as Run)
                : r
            );
          }
          // New run? Usually created via API first, but we could add if missing.
          return prev;
        });
      }
    });
  }, [snapshotId]);

  const startRun = async (type: "audit" | "suggest") => {
    setIsStarting(type);
    try {
      const res = await fetch(`/api/snapshots/${snapshotId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const { run } = await res.json();
        setRuns((prev) => [run, ...prev]);
      }
    } finally {
      setIsStarting(null);
    }
  };

  const auditRun = runs.find((r) => r.type === "AUDIT");
  const suggestRun = runs.find((r) => r.type === "SUGGEST");

  return (
    <Card padding="lg" className="flex flex-col gap-6">
      <Heading level="h3">Analysis</Heading>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 p-4 border border-mdt-border rounded-mdt-lg bg-mdt-surface-subtle">
          <div className="flex justify-between items-center">
            <Heading level="h3">Audit</Heading>
            {auditRun && <RunStatusBadge status={auditRun.status} />}
          </div>
          <Text size="bodySm" tone="muted">
            Check for missing, conflicting, or malformed instructions.
          </Text>
          <Button
            size="sm"
            onClick={() => startRun("audit")}
            disabled={isStarting === "audit" || auditRun?.status === "RUNNING"}
          >
            {isStarting === "audit" ? "Starting..." : "Run Audit"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 p-4 border border-mdt-border rounded-mdt-lg bg-mdt-surface-subtle">
          <div className="flex justify-between items-center">
            <Heading level="h3">Suggest</Heading>
            {suggestRun && <RunStatusBadge status={suggestRun.status} />}
          </div>
          <Text size="bodySm" tone="muted">
            Get AI-powered suggestions to improve your instructions.
          </Text>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => startRun("suggest")}
            disabled={isStarting === "suggest" || suggestRun?.status === "RUNNING"}
          >
            {isStarting === "suggest" ? "Starting..." : "Run Suggest"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
