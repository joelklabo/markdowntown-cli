import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { PatchStatus } from "@prisma/client";
import { resetRateLimitStore } from "@/lib/rateLimiter";
import { validatePatchInput } from "@/lib/cli/patches";

const VALID_HASH = "a".repeat(64);

const { requireCliTokenMock, createPatchMock, listPatchesMock, getPatchMock } = vi.hoisted(() => {
  return {
    requireCliTokenMock: vi.fn(),
    createPatchMock: vi.fn(),
    listPatchesMock: vi.fn(),
    getPatchMock: vi.fn(),
  };
});

vi.mock("@/lib/cli/upload", () => ({ requireCliToken: requireCliTokenMock }));
vi.mock("@/lib/prisma", () => ({ hasDatabaseEnv: true }));
vi.mock("@/lib/cli/patches", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cli/patches")>("@/lib/cli/patches");
  return {
    ...actual,
    createPatch: createPatchMock,
    listPatches: listPatchesMock,
    getPatch: getPatchMock,
  };
});

const patchesRoute = import("@/app/api/cli/patches/route");

describe("cli-patches", () => {
  it("accepts a valid patch payload", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "README.md",
      baseBlobHash: VALID_HASH,
      patchFormat: "unified",
      patchBody: "diff --git a/README.md b/README.md",
    });
    expect(error).toBeNull();
  });

  it("rejects invalid paths", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "../secrets.txt",
      baseBlobHash: VALID_HASH,
      patchFormat: "unified",
      patchBody: "diff",
    });
    expect(error).toMatch(/path/i);
  });

  it("rejects invalid blob hashes", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "README.md",
      baseBlobHash: "bad-hash",
      patchFormat: "unified",
      patchBody: "diff",
    });
    expect(error).toMatch(/hash/i);
  });

  it("rejects invalid patch formats", () => {
    const error = validatePatchInput({
      snapshotId: "snap_123",
      path: "README.md",
      baseBlobHash: VALID_HASH,
      patchFormat: "",
      patchBody: "diff",
    });
    expect(error).toMatch(/format/i);
  });
});

describe("cli-patches API", () => {
  beforeEach(() => {
    resetRateLimitStore();
    requireCliTokenMock.mockReset();
    createPatchMock.mockReset();
    listPatchesMock.mockReset();
    getPatchMock.mockReset();
  });

  it("requires CLI auth", async () => {
    requireCliTokenMock.mockResolvedValue({ response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });

    const { GET } = await patchesRoute;
    const res = await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1"));

    expect(res.status).toBe(401);
  });

  it("lists patches for a snapshot", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockResolvedValue([
      {
        id: "patch-1",
        snapshotId: "snap-1",
        path: "README.md",
        baseBlobHash: VALID_HASH,
        patchFormat: "unified",
        patchBody: "diff",
        status: PatchStatus.PROPOSED,
        createdAt: new Date(),
        appliedAt: null,
      },
    ]);

    const { GET } = await patchesRoute;
    const res = await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.patches).toHaveLength(1);
  });

  it("supports pagination for listing patches", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockResolvedValue([
      { id: "p1", createdAt: new Date() },
      { id: "p2", createdAt: new Date() },
    ]);

    const { GET } = await patchesRoute;
    const res = await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1&limit=2"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.patches).toHaveLength(2);
    expect(json.nextCursor).toBe("p2");
    expect(listPatchesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 2,
      cursor: undefined,
    }));
  });

  it("clamps limit to max 100", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockResolvedValue([]);

    const { GET } = await patchesRoute;
    await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1&limit=200"));

    expect(listPatchesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 100,
    }));
  });

  it("clamps limit to min 1", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockResolvedValue([]);

    const { GET } = await patchesRoute;
    await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1&limit=0"));

    expect(listPatchesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 1,
    }));
  });

  it("returns null nextCursor when results < limit", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockResolvedValue([{ id: "p1", createdAt: new Date() }]);

    const { GET } = await patchesRoute;
    const res = await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1&limit=10"));
    const json = await res.json();

    expect(json.nextCursor).toBeNull();
  });

  it("passes cursor parameter correctly", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockResolvedValue([]);

    const { GET } = await patchesRoute;
    await GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1&cursor=prev_cursor"));

    expect(listPatchesMock).toHaveBeenCalledWith(expect.objectContaining({
      cursor: "prev_cursor",
    }));
  });

  it("propagates database errors", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listPatchesMock.mockRejectedValue(new Error("Database connection failed"));

    const { GET } = await patchesRoute;
    await expect(GET(new Request("http://localhost/api/cli/patches?snapshotId=snap-1"))).rejects.toThrow("Database connection failed");
  });

  it("returns raw patch bodies", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    getPatchMock.mockResolvedValue({
      id: "patch-1",
      snapshotId: "snap-1",
      path: "README.md",
      baseBlobHash: VALID_HASH,
      patchFormat: "unified",
      patchBody: "diff",
      status: PatchStatus.PROPOSED,
      createdAt: new Date(),
      appliedAt: null,
    });

    const { GET } = await patchesRoute;
    const res = await GET(new Request("http://localhost/api/cli/patches?patchId=patch-1&format=raw"));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toBe("diff");
  });

  it("creates patches via POST", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    createPatchMock.mockResolvedValue({
      id: "patch-1",
      snapshotId: "snap-1",
      path: "README.md",
      baseBlobHash: VALID_HASH,
      patchFormat: "unified",
      patchBody: "diff",
      status: PatchStatus.PROPOSED,
      createdAt: new Date(),
      appliedAt: null,
    });

    const { POST } = await patchesRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/patches", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          path: "README.md",
          baseBlobHash: VALID_HASH,
          patchFormat: "unified",
          patchBody: "diff",
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.patch.id).toBe("patch-1");
  });

  it("surfaces patch create errors", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    createPatchMock.mockRejectedValue(new Error("Patch create failed"));

    const { POST } = await patchesRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/patches", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          path: "README.md",
          baseBlobHash: VALID_HASH,
          patchFormat: "unified",
          patchBody: "diff",
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Patch create failed");
  });
});
