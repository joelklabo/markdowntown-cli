import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanupAuditIssues } from "@/lib/audit/store";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditIssue: {
      deleteMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    snapshot: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/observability", () => ({
  auditLog: vi.fn(),
}));

describe("audit cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes expired audit issues by TTL", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.auditIssue.deleteMany).mockResolvedValue({ count: 10 } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);

    const result = await cleanupAuditIssues();

    expect(result.deleted).toBe(10);
    expect(prisma.auditIssue.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          snapshot: {
            createdAt: { lt: expect.any(Date) },
          },
        },
      })
    );
  });

  it("enforces per-project snapshot limits", async () => {
    // 1. No expired issues by TTL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.auditIssue.deleteMany).mockResolvedValueOnce({ count: 0 } as any);
    
    // 2. One project found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.project.findMany).mockResolvedValue([{ id: "proj_1" }] as any);
    
    // 3. Project has 52 snapshots with issues (limit is 50)
    const snapshots = Array.from({ length: 52 }, (_, i) => ({
      id: `snap_${i}`,
      createdAt: new Date(Date.now() - i * 1000),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.snapshot.findMany).mockResolvedValue(snapshots as any);
    
    // 4. Delete issues for the 2 oldest snapshots
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.auditIssue.deleteMany).mockResolvedValueOnce({ count: 200 } as any);

    const result = await cleanupAuditIssues();

    expect(result.deleted).toBe(200);
    expect(prisma.auditIssue.deleteMany).toHaveBeenCalledTimes(2);
    
    // Check that we deleted the oldest snapshots (index 50 and 51)
    expect(prisma.auditIssue.deleteMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          snapshotId: { in: ["snap_50", "snap_51"] },
        },
      })
    );
  });

  it("returns 0 when no issues to clean up", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.auditIssue.deleteMany).mockResolvedValue({ count: 0 } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);

    const result = await cleanupAuditIssues();

    expect(result.deleted).toBe(0);
  });
});
