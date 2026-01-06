import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AUDIT_RETENTION_DAYS = 30;
const MAX_AUDIT_SNAPSHOTS_PER_PROJECT = 50;

async function cleanupAuditIssues() {
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

  return { deleted: totalDeleted };
}

async function main() {
  console.log("[Cleanup] Starting audit issue cleanup...");
  try {
    const { deleted } = await cleanupAuditIssues();
    console.log(`[Cleanup] Successfully removed ${deleted} expired audit issues.`);
  } catch (error) {
    console.error("[Cleanup] Failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Cleanup] Fatal error:", err);
  process.exit(1);
});
