import type { AuditIssue, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRepoPath } from "@/lib/cli/patches";
import { 
  validateAuditIssue, 
  MAX_AUDIT_ISSUES_PER_UPLOAD, 
  AUDIT_RETENTION_DAYS, 
  MAX_AUDIT_SNAPSHOTS_PER_PROJECT 
} from "@/lib/validation";
import { auditLog } from "@/lib/observability";

export type AuditIssueInput = {
  ruleId: string;
  severity: AuditSeverity;
  path: string;
  message: string;
};

type StoredAuditIssue = {
  snapshotId: string;
  ruleId: string;
  severity: AuditSeverity;
  path: string;
  message: string;
};

function normalizeIssue(issue: AuditIssueInput): StoredAuditIssue {
  const ruleId = issue.ruleId.trim();
  if (!ruleId) {
    throw new Error("Rule id is required");
  }

  const message = issue.message.trim();
  if (!message) {
    throw new Error("Message is required");
  }

  const validationError = validateAuditIssue(ruleId, message);
  if (validationError) {
    throw new Error(validationError);
  }

  const pathResult = normalizeRepoPath(issue.path);
  if (pathResult.error) {
    throw new Error(pathResult.error);
  }

  return {
    snapshotId: "",
    ruleId,
    severity: issue.severity,
    path: pathResult.path,
    message,
  };
}

export async function storeAuditIssues(options: {
  userId: string;
  snapshotId: string;
  issues: AuditIssueInput[];
}): Promise<{ stored: number }> {
  const snapshot = await prisma.snapshot.findFirst({
    where: { id: options.snapshotId, project: { userId: options.userId } },
  });
  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  if (options.issues.length > MAX_AUDIT_ISSUES_PER_UPLOAD) {
    throw new Error(`Too many audit issues (max ${MAX_AUDIT_ISSUES_PER_UPLOAD})`);
  }

  const normalized = options.issues.map((issue) => {
    const entry = normalizeIssue(issue);
    return { ...entry, snapshotId: options.snapshotId };
  });

  await prisma.$transaction(async (tx) => {
    await tx.auditIssue.deleteMany({ where: { snapshotId: options.snapshotId } });
    if (normalized.length > 0) {
      await tx.auditIssue.createMany({ data: normalized });
    }
  });

  return { stored: normalized.length };
}

export async function listAuditIssues(options: {
  userId: string;
  snapshotId: string;
  severity?: AuditSeverity;
  limit?: number;
  cursor?: string | null;
}): Promise<AuditIssue[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), MAX_AUDIT_ISSUES_PER_UPLOAD);
  return prisma.auditIssue.findMany({
    where: {
      snapshotId: options.snapshotId,
      severity: options.severity,
      snapshot: { project: { userId: options.userId } },
    },
    take: limit,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    orderBy: [{ severity: "desc" }, { path: "asc" }, { id: "asc" }],
  });
}

/**
 * Cleanup expired audit issues based on TTL and per-project limits.
 * Does not delete snapshots, only the linked audit issues.
 */
export async function cleanupAuditIssues(): Promise<{ deleted: number }> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - AUDIT_RETENTION_DAYS);

  let totalDeleted = 0;

  // 1. Delete issues for snapshots older than retention TTL
  const expiredIssues = await prisma.auditIssue.deleteMany({
    where: {
      snapshot: {
        createdAt: { lt: retentionDate },
      },
    },
  });
  totalDeleted += expiredIssues.count;

  // 2. Enforce per-project snapshot issue limit
  // Find projects that have more than MAX_AUDIT_SNAPSHOTS_PER_PROJECT snapshots with issues
  const projects = await prisma.project.findMany({
    select: { id: true },
    where: {
      snapshots: {
        some: {
          auditIssues: { some: {} },
        },
      },
    },
  });

  for (const project of projects) {
    // Get all snapshots for this project that have audit issues, ordered by creation date
    const snapshotsWithIssues = await prisma.snapshot.findMany({
      where: {
        projectId: project.id,
        auditIssues: { some: {} },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (snapshotsWithIssues.length > MAX_AUDIT_SNAPSHOTS_PER_PROJECT) {
      const idsToDelete = snapshotsWithIssues
        .slice(MAX_AUDIT_SNAPSHOTS_PER_PROJECT)
        .map((s) => s.id);

      const deleted = await prisma.auditIssue.deleteMany({
        where: {
          snapshotId: { in: idsToDelete },
        },
      });
      totalDeleted += deleted.count;
    }
  }

  if (totalDeleted > 0) {
    auditLog("audit_issues_cleanup", {
      totalDeleted,
      retentionDays: AUDIT_RETENTION_DAYS,
      maxSnapshotsPerProject: MAX_AUDIT_SNAPSHOTS_PER_PROJECT,
    });
  }

  return { deleted: totalDeleted };
}
