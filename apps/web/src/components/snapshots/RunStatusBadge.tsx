import { Badge } from "@/components/ui/Badge";
import type { RunStatus } from "@prisma/client";

interface RunStatusBadgeProps {
  status: RunStatus;
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const toneMap: Record<RunStatus, "neutral" | "primary" | "success" | "danger"> = {
    QUEUED: "neutral",
    RUNNING: "primary",
    SUCCESS: "success",
    FAILED: "danger",
  };

  return (
    <Badge tone={toneMap[status]} className="font-mono">
      {status}
    </Badge>
  );
}
