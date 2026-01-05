import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";

const createUploadHandshakeMock = vi.fn();
const requireCliTokenMock = vi.fn();

vi.mock("@/lib/cli/upload", () => ({
  createUploadHandshake: createUploadHandshakeMock,
  requireCliToken: requireCliTokenMock,
}));

vi.mock("@/lib/prisma", () => ({ hasDatabaseEnv: true }));

const handshakeRoute = import("@/app/api/cli/upload/handshake/route");

describe("cli-upload handshake API", () => {
  beforeEach(() => {
    resetRateLimitStore();
    createUploadHandshakeMock.mockReset();
    requireCliTokenMock.mockReset();
  });

  it("requires CLI auth", async () => {
    requireCliTokenMock.mockResolvedValue({ response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const { POST } = await handshakeRoute;

    const res = await POST(
      new Request("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        body: JSON.stringify({ manifest: [{ path: "README.md", blobHash: "a".repeat(64), sizeBytes: 1 }] }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("validates handshake payloads", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    const { POST } = await handshakeRoute;

    const res = await POST(
      new Request("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        body: JSON.stringify({ projectId: "project-1" }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns missing blobs on success", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    createUploadHandshakeMock.mockResolvedValue({
      snapshotId: "snapshot-1",
      missingBlobs: ["hash-1"],
      upload: { method: "direct" },
    });

    const { POST } = await handshakeRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        body: JSON.stringify({
          projectId: "project-1",
          manifest: [{ path: "README.md", blobHash: "a".repeat(64), sizeBytes: 1 }],
        }),
      })
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.snapshotId).toBe("snapshot-1");
    expect(json.missingBlobs).toEqual(["hash-1"]);
  });

  it("surfaces handshake errors", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    createUploadHandshakeMock.mockRejectedValue(new Error("Bad manifest"));

    const { POST } = await handshakeRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        body: JSON.stringify({
          projectId: "project-1",
          manifest: [{ path: "README.md", blobHash: "a".repeat(64), sizeBytes: 1 }],
        }),
      })
    );

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Bad manifest");
  });
});
