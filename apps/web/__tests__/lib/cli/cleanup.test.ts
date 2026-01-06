import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cleanupStaleUploads,
  cleanupExpiredDeviceCodes,
  cleanupExpiredCliTokens,
  cleanupAllCliAuth,
} from "@/lib/cli/cleanup";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    snapshot: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    blob: {
      deleteMany: vi.fn(),
    },
    cliDeviceCode: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    cliToken: {
      findMany: vi.fn(),
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

describe("cleanupExpiredDeviceCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes expired device codes past retention period", async () => {
    prismaMock.cliDeviceCode.findMany.mockResolvedValueOnce([
      { id: "code-1" },
      { id: "code-2" },
    ]);
    prismaMock.cliDeviceCode.deleteMany.mockResolvedValueOnce({ count: 2 });

    const result = await cleanupExpiredDeviceCodes({ retentionDays: 7 });

    expect(result.deletedCount).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(prismaMock.cliDeviceCode.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["code-1", "code-2"] } },
    });
  });

  it("respects batch size and indicates more records exist", async () => {
    const codes = Array.from({ length: 100 }, (_, i) => ({ id: `code-${i}` }));
    prismaMock.cliDeviceCode.findMany.mockResolvedValueOnce(codes);
    prismaMock.cliDeviceCode.deleteMany.mockResolvedValueOnce({ count: 100 });

    const result = await cleanupExpiredDeviceCodes({ batchSize: 100 });

    expect(result.hasMore).toBe(true);
  });

  it("skips deletion if no expired codes found", async () => {
    prismaMock.cliDeviceCode.findMany.mockResolvedValueOnce([]);

    const result = await cleanupExpiredDeviceCodes({ retentionDays: 7 });

    expect(result.deletedCount).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(prismaMock.cliDeviceCode.deleteMany).not.toHaveBeenCalled();
  });
});

describe("cleanupExpiredCliTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes revoked and expired tokens past retention period", async () => {
    prismaMock.cliToken.findMany.mockResolvedValueOnce([
      { id: "token-1" },
      { id: "token-2" },
      { id: "token-3" },
    ]);
    prismaMock.cliToken.deleteMany.mockResolvedValueOnce({ count: 3 });

    const result = await cleanupExpiredCliTokens({ retentionDays: 30 });

    expect(result.deletedCount).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(prismaMock.cliToken.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["token-1", "token-2", "token-3"] } },
    });
  });

  it("respects batch size and indicates more records exist", async () => {
    const tokens = Array.from({ length: 500 }, (_, i) => ({ id: `token-${i}` }));
    prismaMock.cliToken.findMany.mockResolvedValueOnce(tokens);
    prismaMock.cliToken.deleteMany.mockResolvedValueOnce({ count: 500 });

    const result = await cleanupExpiredCliTokens({ batchSize: 500 });

    expect(result.hasMore).toBe(true); // Batch size reached, might be more
  });

  it("skips deletion if no expired tokens found", async () => {
    prismaMock.cliToken.findMany.mockResolvedValueOnce([]);

    const result = await cleanupExpiredCliTokens({ retentionDays: 30 });

    expect(result.deletedCount).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(prismaMock.cliToken.deleteMany).not.toHaveBeenCalled();
  });
});

describe("cleanupAllCliAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs both device code and token cleanup concurrently", async () => {
    prismaMock.cliDeviceCode.findMany.mockResolvedValueOnce([{ id: "code-1" }]);
    prismaMock.cliDeviceCode.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.cliToken.findMany.mockResolvedValueOnce([{ id: "token-1" }]);
    prismaMock.cliToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await cleanupAllCliAuth();

    expect(result.deviceCodes.deletedCount).toBe(1);
    expect(result.tokens.deletedCount).toBe(1);
    expect(prismaMock.cliDeviceCode.findMany).toHaveBeenCalled();
    expect(prismaMock.cliToken.findMany).toHaveBeenCalled();
  });

  it("returns zero counts when nothing to clean up", async () => {
    prismaMock.cliDeviceCode.findMany.mockResolvedValueOnce([]);
    prismaMock.cliToken.findMany.mockResolvedValueOnce([]);

    const result = await cleanupAllCliAuth();

    expect(result.deviceCodes.deletedCount).toBe(0);
    expect(result.tokens.deletedCount).toBe(0);
  });
});