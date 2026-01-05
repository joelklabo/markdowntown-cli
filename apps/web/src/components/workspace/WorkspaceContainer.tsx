"use client";

import { useState } from "react";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { WorkspaceEditor } from "./WorkspaceEditor";
import { RunResults } from "@/components/snapshots/RunResults";
import type { WorkspaceData } from "@/lib/workspace/serialize";
import type { Run } from "@prisma/client";

interface WorkspaceContainerProps {
  initialData: WorkspaceData;
  projectId: string;
  snapshotId: string;
  projectName: string;
  initialRuns: Run[];
}

export function WorkspaceContainer({
  initialData,
  projectId,
  snapshotId,
  projectName,
  initialRuns,
}: WorkspaceContainerProps) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [isRerunning, setIsRerunning] = useState(false);

  const handleRerun = async () => {
    setIsRerunning(true);
    try {
      const res = await fetch(`/api/workspaces/${initialData.workspace.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "audit" }),
      });
      if (res.ok) {
        const { run } = await res.json();
        setRuns((prev) => [run, ...prev]);
      }
    } finally {
      setIsRerunning(false);
    }
  };

  return (
    <>
      <WorkspaceToolbar
        projectId={projectId}
        snapshotId={snapshotId}
        projectName={projectName}
        onRerun={handleRerun}
        isRerunning={isRerunning}
      />
      <div className="flex flex-col gap-8">
        <WorkspaceEditor
          initialData={initialData}
          snapshotId={snapshotId}
          workspaceId={initialData.workspace.id}
        />
        <RunResults runs={runs} />
      </div>
    </>
  );
}
