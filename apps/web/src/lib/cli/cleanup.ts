import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/reports";

/**
 * Identifies and removes incomplete uploads older than the specified age.
 * Also cleans up orphaned blobs that are no longer referenced by any snapshot.
 */
export async function cleanupStaleUploads(options: { maxAgeHours: number }) {
  const threshold = new Date(Date.now() - options.maxAgeHours * 60 * 60 * 1000);

  // 1. Find stale UPLOADING snapshots
  const staleSnapshots = await prisma.snapshot.findMany({
    where: {
      status: "UPLOADING",
      updatedAt: { lt: threshold },
    },
    select: { id: true, projectId: true },
  });

  const ids = staleSnapshots.map((s) => s.id);
  if (ids.length > 0) {
    // 2. Delete stale snapshots (cascade will handle files)
    const { count } = await prisma.snapshot.deleteMany({
      where: { id: { in: ids } },
    });

    logAuditEvent({
      event: "cli_upload_cleanup",
      metadata: {
        snapshotCount: count,
        maxAgeHours: options.maxAgeHours,
      },
    });
  }

  // 3. Cleanup orphaned blobs
  const { count: blobCount } = await prisma.blob.deleteMany({
    where: {
      snapshotFiles: { none: {} },
    },
  });

  if (blobCount > 0) {
    logAuditEvent({
      event: "blob_gc_cleanup",
      metadata: {
        blobCount,
      },
    });
  }

  return {
    deletedSnapshots: ids.length,
    deletedBlobs: blobCount,
  };
}
