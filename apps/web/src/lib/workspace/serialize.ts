import type { Workspace, WorkspaceFileEdit, Snapshot, SnapshotFile } from "@prisma/client";

export type WorkspaceData = {
  workspace: Workspace & {
    snapshot: Snapshot & {
      files: SnapshotFile[];
    };
    edits: WorkspaceFileEdit[];
  };
};

export function getFileContent(
  workspaceData: WorkspaceData,
  path: string,
  baseContent: string | null
): string {
  const edit = workspaceData.workspace.edits.find((e) => e.path === path);
  if (edit) return edit.content;
  return baseContent ?? "";
}
