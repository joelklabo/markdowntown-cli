import { prisma } from "@/lib/prisma";
import { getBlobStore } from "@/lib/storage";

export async function generateUnifiedDiff(
  path: string,
  baseContent: string,
  newContent: string
): Promise<string> {
  const baseLines = baseContent.split("\n");
  const newLines = newContent.split("\n");

  let diff = `diff --git a/${path} b/${path}\n`;
  diff += `--- a/${path}\n`;
  diff += `+++ b/${path}\n`;
  diff += `@@ -1,${baseLines.length} +1,${newLines.length} @@\n`;

  for (const line of baseLines) {
    diff += `-${line}\n`;
  }
  for (const line of newLines) {
    diff += `+${line}\n`;
  }

  return diff;
}

export async function createPatchFromEdit(
  userId: string,
  snapshotId: string,
  path: string,
  content: string
) {
  const snapshot = await prisma.snapshot.findFirst({
    where: { id: snapshotId, project: { userId } },
    include: { files: { where: { path }, include: { blob: true } } },
  });

  if (!snapshot || snapshot.files.length === 0) {
    throw new Error("File not found in snapshot");
  }

  const file = snapshot.files[0];
  const store = getBlobStore();
  const baseBlob = await store.getBlob(file.blob.sha256);
  const baseContent = baseBlob ? baseBlob.toString("utf8") : "";

  const patchBody = await generateUnifiedDiff(path, baseContent, content);

  return prisma.patch.create({
    data: {
      snapshotId,
      path,
      baseBlobHash: file.blob.sha256,
      patchFormat: "unified",
      patchBody,
      status: "PROPOSED",
    },
  });
}
