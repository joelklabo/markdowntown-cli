import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCliToken } from "@/lib/requireCliToken";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cliToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("requireCliToken", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects request without authorization header", async () => {
    const req = new NextRequest("http://localhost");
    const { response } = await requireCliToken(req);
    expect(response?.status).toBe(401);
  });

  it("rejects invalid token", async () => {
    prismaMock.cliToken.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://localhost", {
      headers: { authorization: "Bearer invalid" },
    });
    const { response } = await requireCliToken(req);
    expect(response?.status).toBe(401);
  });

  it("rejects revoked token", async () => {
    prismaMock.cliToken.findUnique.mockResolvedValue({
      id: "token-1",
      revokedAt: new Date(),
    });
    const req = new NextRequest("http://localhost", {
      headers: { authorization: "Bearer revoked" },
    });
    const { response } = await requireCliToken(req);
    expect(response?.status).toBe(401);
  });

  it("rejects expired token", async () => {
    prismaMock.cliToken.findUnique.mockResolvedValue({
      id: "token-1",
      expiresAt: new Date(Date.now() - 1000),
    });
    const req = new NextRequest("http://localhost", {
      headers: { authorization: "Bearer expired" },
    });
    const { response } = await requireCliToken(req);
    expect(response?.status).toBe(401);
    const json = await response?.json();
    expect(json.error).toBe("Token expired");
  });

  it("accepts valid token and updates lastUsedAt", async () => {
    const tokenRecord = {
      id: "token-1",
      userId: "user-1",
      scopes: ["cli:read"],
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    };
    prismaMock.cliToken.findUnique.mockResolvedValue(tokenRecord);
    prismaMock.cliToken.update.mockResolvedValue(tokenRecord);

    const req = new NextRequest("http://localhost", {
      headers: { authorization: "Bearer valid" },
    });
    const { token, response } = await requireCliToken(req, ["cli:read"]);
    
    expect(response).toBeUndefined();
    expect(token?.id).toBe("token-1");
    expect(prismaMock.cliToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("rejects token with missing scopes", async () => {
    prismaMock.cliToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      scopes: ["cli:read"],
    });
    const req = new NextRequest("http://localhost", {
      headers: { authorization: "Bearer valid" },
    });
    const { response } = await requireCliToken(req, ["cli:upload"]);
    expect(response?.status).toBe(403);
    const json = await response?.json();
    expect(json.error).toBe("Missing scopes");
    expect(json.missing).toEqual(["cli:upload"]);
  });
});
