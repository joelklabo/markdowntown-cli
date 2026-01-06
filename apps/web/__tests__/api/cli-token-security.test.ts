import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";
import { issueCliToken } from "@/lib/cli/tokens";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cliToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  hasDatabaseEnv: true,
}));

const handshakeRoute = import("@/app/api/cli/upload/handshake/route");

describe("CLI token security", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.mocked(prisma.cliToken.create).mockReset();
    vi.mocked(prisma.cliToken.findUnique).mockReset();
    vi.mocked(prisma.cliToken.update).mockReset();
  });

  it("blocks requests with revoked token", async () => {
    vi.mocked(prisma.cliToken.create).mockResolvedValue({
      id: "token-id",
      userId: "user-1",
      tokenHash: "hash",
      tokenPrefix: "prefix",
      scopes: ["cli:upload"],
      label: "test",
      createdAt: new Date(),
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: null,
    });
    const { token, tokenId } = await issueCliToken({
      userId: "user-1",
      scopes: ["cli:upload"],
    });

    vi.mocked(prisma.cliToken.findUnique).mockResolvedValue({
      id: tokenId,
      userId: "user-1",
      tokenHash: "hash",
      tokenPrefix: "prefix",
      scopes: ["cli:upload"],
      label: "test",
      createdAt: new Date(),
      revokedAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
    });

    const { POST } = await handshakeRoute;
    const res = await POST(
      new NextRequest("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ manifest: [{ path: "a", blobHash: "b", sizeBytes: 1 }] }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("blocks requests with expired token", async () => {
    vi.mocked(prisma.cliToken.create).mockResolvedValue({
      id: "token-id",
      userId: "user-1",
      tokenHash: "hash",
      tokenPrefix: "prefix",
      scopes: ["cli:upload"],
      label: "test",
      createdAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      lastUsedAt: null,
    });
    const { token } = await issueCliToken({
      userId: "user-1",
      scopes: ["cli:upload"],
      expiresAt: new Date(Date.now() - 1000),
    });

    vi.mocked(prisma.cliToken.findUnique).mockResolvedValue({
      id: "token-id",
      userId: "user-1",
      tokenHash: "hash",
      tokenPrefix: "prefix",
      scopes: ["cli:upload"],
      label: "test",
      createdAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      lastUsedAt: null,
    });

    const { POST } = await handshakeRoute;
    const res = await POST(
      new NextRequest("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ manifest: [{ path: "a", blobHash: "b", sizeBytes: 1 }] }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("enforces rate limits with Retry-After", async () => {
    const { POST } = await handshakeRoute;

    // Spam requests up to limit (30 for handshake)
    for (let i = 0; i < 30; i++) {
      await POST(
        new NextRequest("http://localhost/api/cli/upload/handshake", {
          method: "POST",
          headers: { "x-forwarded-for": "1.2.3.4" },
          body: JSON.stringify({ manifest: [{ path: "a", blobHash: "b", sizeBytes: 1 }] }),
        })
      );
    }

    // Next one should be limited
    const res = await POST(
      new NextRequest("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        headers: { "x-forwarded-for": "1.2.3.4" },
        body: JSON.stringify({ manifest: [{ path: "a", blobHash: "b", sizeBytes: 1 }] }),
      })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });
});