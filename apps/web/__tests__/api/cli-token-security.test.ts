import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";

const requireCliTokenMock = vi.fn();
vi.mock("@/lib/requireCliToken", () => ({ requireCliToken: requireCliTokenMock }));

vi.mock("@/lib/prisma", () => ({ hasDatabaseEnv: true }));

const handshakeRoute = import("@/app/api/cli/upload/handshake/route");

describe("CLI token security", () => {
  beforeEach(() => {
    resetRateLimitStore();
    requireCliTokenMock.mockReset();
  });

  it("blocks requests with revoked token", async () => {
    requireCliTokenMock.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    
    const { POST } = await handshakeRoute;
    const res = await POST(
      new NextRequest("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        body: JSON.stringify({ manifest: [{ path: "a", blobHash: "b", sizeBytes: 1 }] }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("enforces rate limits with Retry-After", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1" } });
    const { POST } = await handshakeRoute;

    // First request
    await POST(
      new NextRequest("http://localhost/api/cli/upload/handshake", {
        method: "POST",
        headers: { "x-forwarded-for": "1.2.3.4" },
        body: JSON.stringify({ manifest: [{ path: "a", blobHash: "b", sizeBytes: 1 }] }),
      })
    );

    // Spam requests up to limit (30 for handshake)
    for (let i = 0; i < 29; i++) {
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
