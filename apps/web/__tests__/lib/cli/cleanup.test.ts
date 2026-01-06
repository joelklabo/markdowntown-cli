import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupStaleUploads } from "@/lib/cli/cleanup";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    snapshot: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    blob: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/reports", () => ({ logAuditEvent: vi.fn() }));

describe("cleanupStaleUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifies and deletes stale snapshots", async () => {
    prismaMock.snapshot.findMany.mockResolvedValueOnce([{ id: "stale-1" }, { id: "stale-2" }]);
    prismaMock.snapshot.deleteMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.blob.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await cleanupStaleUploads({ maxAgeHours: 24 });

    expect(result.deletedSnapshots).toBe(2);
    expect(prismaMock.snapshot.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["stale-1", "stale-2"] } },
    });
  });

  it("skips deletion if no stale snapshots found", async () => {
    prismaMock.snapshot.findMany.mockResolvedValueOnce([]);
    prismaMock.blob.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await cleanupStaleUploads({ maxAgeHours: 24 });

    expect(result.deletedSnapshots).toBe(0);
    expect(prismaMock.snapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("cleans up orphaned blobs even if no stale snapshots", async () => {
    prismaMock.snapshot.findMany.mockResolvedValueOnce([]);
    prismaMock.blob.deleteMany.mockResolvedValueOnce({ count: 5 });

    const result = await cleanupStaleUploads({ maxAgeHours: 24 });

    expect(result.deletedBlobs).toBe(5);
    expect(prismaMock.blob.deleteMany).toHaveBeenCalledWith({
      where: { snapshotFiles: { none: {} } },
    });
  });
});