import { prisma } from "@/lib/prisma";
import type { Workspace, WorkspaceFileEdit } from "@prisma/client";

export async function createWorkspace(
  userId: string,
  snapshotId: string
): Promise<Workspace> {
  const snapshot = await prisma.snapshot.findFirst({
    where: {
      id: snapshotId,
      project: { userId },
    },
  });

  if (!snapshot) {
    throw new Error("Snapshot not found or access denied");
  }

  return prisma.workspace.create({
    data: {
      snapshotId,
    },
  });
}

export async function saveFileEdit(
  userId: string,
  workspaceId: string,
  path: string,
  content: string
): Promise<WorkspaceFileEdit> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      snapshot: {
        project: { userId },
      },
    },
  });

  if (!workspace) {
    throw new Error("Workspace not found or access denied");
  }

  return prisma.workspaceFileEdit.upsert({
    where: {
      workspaceId_path: {
        workspaceId,
        path,
      },
    },
    update: {
      content,
    },
    create: {
      workspaceId,
      path,
      content,
    },
  });
}

export async function getWorkspace(userId: string, id: string) {
  return prisma.workspace.findFirst({
    where: {
      id,
      snapshot: {
        project: { userId },
      },
    },
    include: {
      edits: true,
      snapshot: {
        include: {
          files: true,
        },
      },
    },
  });
}

export async function findOrCreateWorkspace(
  userId: string,
  snapshotId: string
) {
  const existing = await prisma.workspace.findFirst({
    where: {
      snapshotId,
      snapshot: {
        project: { userId },
      },
    },
    include: {
      edits: true,
      snapshot: {
        include: {
          files: true,
        },
      },
    },
  });

  if (existing) return existing;

  const snapshot = await prisma.snapshot.findFirst({
    where: { id: snapshotId, project: { userId } },
  });
  if (!snapshot) throw new Error("Snapshot not found or access denied");

  return prisma.workspace.create({
    data: {
      snapshotId,
    },
    include: {
      edits: true,
      snapshot: {
        include: {
          files: true,
        },
      },
    },
  });
}
