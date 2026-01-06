import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/reports";

/**
 * Default retention window for expired device codes (in days).
 * Device codes are removed after they've been expired for this duration.
 */
export const DEFAULT_DEVICE_CODE_RETENTION_DAYS = 7;

/**
 * Default retention window for revoked/expired CLI tokens (in days).
 * Tokens are removed after they've been revoked/expired for this duration.
 */
export const DEFAULT_CLI_TOKEN_RETENTION_DAYS = 30;

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

/**
 * Removes expired CLI device codes that have been in terminal state
 * (EXPIRED, DENIED, or APPROVED) for longer than the retention period.
 *
 * Retention policy:
 * - Device codes are kept for DEFAULT_DEVICE_CODE_RETENTION_DAYS after expiration
 * - This allows for debugging and audit trails
 * - Only removes records in incremental batches to avoid long-running transactions
 */
export async function cleanupExpiredDeviceCodes(options?: {
  retentionDays?: number;
  batchSize?: number;
}) {
  const retentionDays = options?.retentionDays ?? DEFAULT_DEVICE_CODE_RETENTION_DAYS;
  const batchSize = options?.batchSize ?? 1000;
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Find expired device codes past retention period
  // Only process a batch at a time to avoid large transactions
  const expiredCodes = await prisma.cliDeviceCode.findMany({
    where: {
      OR: [
        // Expired device codes past retention
        {
          status: "EXPIRED",
          expiresAt: { lt: threshold },
        },
        // Denied codes past retention (based on updatedAt)
        {
          status: "DENIED",
          updatedAt: { lt: threshold },
        },
        // Approved codes that are also expired and past retention
        {
          status: "APPROVED",
          expiresAt: { lt: threshold },
        },
      ],
    },
    select: { id: true },
    take: batchSize,
  });

  const ids = expiredCodes.map((code) => code.id);
  let deletedCount = 0;

  if (ids.length > 0) {
    const { count } = await prisma.cliDeviceCode.deleteMany({
      where: { id: { in: ids } },
    });
    deletedCount = count;

    logAuditEvent({
      event: "cli_device_code_cleanup",
      metadata: {
        deletedCount,
        retentionDays,
        batchSize,
      },
    });
  }

  return {
    deletedCount,
    hasMore: ids.length === batchSize,
  };
}

/**
 * Removes revoked or expired CLI tokens that have been in that state
 * for longer than the retention period.
 *
 * Retention policy:
 * - Revoked tokens: kept for DEFAULT_CLI_TOKEN_RETENTION_DAYS after revocation
 * - Expired tokens: kept for DEFAULT_CLI_TOKEN_RETENTION_DAYS after expiration
 * - Active tokens (not revoked/expired): never cleaned up
 * - Batch processing to avoid long-running transactions
 */
export async function cleanupExpiredCliTokens(options?: {
  retentionDays?: number;
  batchSize?: number;
}) {
  const retentionDays = options?.retentionDays ?? DEFAULT_CLI_TOKEN_RETENTION_DAYS;
  const batchSize = options?.batchSize ?? 1000;
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Find tokens that are revoked or expired, past retention period
  const expiredTokens = await prisma.cliToken.findMany({
    where: {
      OR: [
        // Revoked tokens past retention
        {
          revokedAt: {
            not: null,
            lt: threshold,
          },
        },
        // Expired tokens past retention
        {
          expiresAt: {
            not: null,
            lt: threshold,
          },
          revokedAt: null, // Don't double-count revoked tokens
        },
      ],
    },
    select: { id: true },
    take: batchSize,
  });

  const ids = expiredTokens.map((token) => token.id);
  let deletedCount = 0;

  if (ids.length > 0) {
    const { count } = await prisma.cliToken.deleteMany({
      where: { id: { in: ids } },
    });
    deletedCount = count;

    logAuditEvent({
      event: "cli_token_cleanup",
      metadata: {
        deletedCount,
        retentionDays,
        batchSize,
      },
    });
  }

  return {
    deletedCount,
    hasMore: ids.length === batchSize,
  };
}

/**
 * Runs all CLI auth cleanup tasks.
 * Returns aggregate statistics for all cleanup operations.
 */
export async function cleanupAllCliAuth(options?: {
  deviceCodeRetentionDays?: number;
  tokenRetentionDays?: number;
  batchSize?: number;
}) {
  const [deviceCodeResult, tokenResult] = await Promise.all([
    cleanupExpiredDeviceCodes({
      retentionDays: options?.deviceCodeRetentionDays,
      batchSize: options?.batchSize,
    }),
    cleanupExpiredCliTokens({
      retentionDays: options?.tokenRetentionDays,
      batchSize: options?.batchSize,
    }),
  ]);

  return {
    deviceCodes: deviceCodeResult,
    tokens: tokenResult,
  };
}
