import type { AuditIssue, AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRepoPath } from "@/lib/cli/patches";
import { MAX_AUDIT_MESSAGE_LENGTH, MAX_AUDIT_RULE_ID_LENGTH } from "@/lib/validation";

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
  if (ruleId.length > MAX_AUDIT_RULE_ID_LENGTH) {
    throw new Error(`Rule id is too long (max ${MAX_AUDIT_RULE_ID_LENGTH} characters)`);
  }

  const message = issue.message.trim();
  if (!message) {
    throw new Error("Message is required");
  }
  if (message.length > MAX_AUDIT_MESSAGE_LENGTH) {
    throw new Error(`Message is too long (max ${MAX_AUDIT_MESSAGE_LENGTH} characters)`);
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
}): Promise<AuditIssue[]> {
  return prisma.auditIssue.findMany({
    where: {
      snapshotId: options.snapshotId,
      severity: options.severity,
      snapshot: { project: { userId: options.userId } },
    },
    orderBy: [{ severity: "desc" }, { path: "asc" }],
  });
}
