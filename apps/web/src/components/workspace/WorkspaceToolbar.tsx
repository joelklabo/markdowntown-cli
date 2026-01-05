"use client";

import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import Link from "next/link";
import { strings } from "@/lib/strings";
import { ExportButton } from "./ExportButton";

interface WorkspaceToolbarProps {
  projectId: string;
  snapshotId: string;
  workspaceId: string;
  projectName: string;
  onRerun: () => Promise<void>;
  isRerunning: boolean;
}

export function WorkspaceToolbar({
  projectId,
  snapshotId,
  workspaceId,
  projectName,
  onRerun,
  isRerunning,
}: WorkspaceToolbarProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2 text-sm text-mdt-muted">
        <Link href="/projects" className="hover:text-mdt-text transition-colors">
          {strings.projects.title}
        </Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-mdt-text transition-colors">
          {projectName}
        </Link>
        <span>/</span>
        <Link href={`/projects/${projectId}/snapshots/${snapshotId}`} className="hover:text-mdt-text transition-colors font-mono">
          {snapshotId.slice(0, 8)}
        </Link>
        <span>/</span>
        <span className="text-mdt-text">Workspace</span>
      </div>

      <div className="flex justify-between items-center">
        <Heading level="h1">Editor Workspace</Heading>
        <div className="flex gap-2">
          <ExportButton workspaceId={workspaceId} />
          <Button
            variant="secondary"
            size="sm"
            onClick={onRerun}
            disabled={isRerunning}
          >
            {isRerunning ? "Analyzing..." : "Rerun Analysis"}
          </Button>
        </div>
      </div>
    </div>
  );
}
