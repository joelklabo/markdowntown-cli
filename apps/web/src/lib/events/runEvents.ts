import type { RunStatus, RunType } from "@prisma/client";
import { auditLog } from "@/lib/observability";
import { logAuditEvent } from "@/lib/reports";

export type RunEventInput = {
  runId: string;
  snapshotId: string;
  projectId?: string | null;
  status: RunStatus;
  type: RunType;
  traceId?: string | null;
  error?: string | null;
};

export function emitRunEvent(event: RunEventInput) {
  auditLog("run_event", {
    runId: event.runId,
    snapshotId: event.snapshotId,
    projectId: event.projectId ?? undefined,
    status: event.status,
    type: event.type,
    traceId: event.traceId ?? undefined,
    error: event.error ?? undefined,
  });

  logAuditEvent({
    event: `run_${event.status.toLowerCase()}`,
    snapshotId: event.snapshotId,
    projectId: event.projectId ?? undefined,
    traceId: event.traceId ?? undefined,
    metadata: {
      runId: event.runId,
      type: event.type,
      status: event.status,
      error: event.error ?? undefined,
    },
  });
}
