"use client";

import { useEffect, useState } from "react";
import { realtimeClient, type RealtimeEvent } from "@/lib/pubsub/client";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/ui/Text";

export function LivingHeader() {
  const [activeRuns, setActiveRuns] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    return realtimeClient.subscribe((event) => {
      if (event.status === "QUEUED" || event.status === "RUNNING") {
        setActiveRuns((prev) => {
          const filtered = prev.filter((r) => r.runId !== event.runId);
          return [event, ...filtered];
        });
      } else {
        // SUCCESS or FAILED
        setActiveRuns((prev) => prev.filter((r) => r.runId !== event.runId));
      }
    });
  }, []);

  if (activeRuns.length === 0) return null;

  const latest = activeRuns[0];

  return (
    <div className="flex items-center gap-2 bg-mdt-surface-subtle px-4 py-1 border-b border-mdt-border overflow-hidden">
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mdt-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-mdt-primary"></span>
          </div>
          <Text size="caption" weight="semibold" className="uppercase tracking-wider text-mdt-primary">
            Live
          </Text>
        </div>
        <Text size="caption" className="truncate text-mdt-muted">
          {latest.type} run {latest.status.toLowerCase()} for snapshot {latest.snapshotId.slice(0, 8)}
        </Text>
      </div>
      {activeRuns.length > 1 && (
        <Badge tone="info" className="shrink-0">
          +{activeRuns.length - 1} more
        </Badge>
      )}
    </div>
  );
}
