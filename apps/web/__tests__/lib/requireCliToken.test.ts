import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCliToken } from "@/lib/requireCliToken";
import { NextRequest } from "next/server";
import { hashToken } from "@/lib/cli/tokens";

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
    const token = "revoked-token";
    prismaMock.cliToken.findUnique.mockResolvedValue({
      id: "token-1",
      tokenHash: hashToken(token),
      revokedAt: new Date(),
    });
    const req = new NextRequest("http://localhost", {
      headers: { authorization: `Bearer ${token}` },
    });
    const { response } = await requireCliToken(req);
    expect(response?.status).toBe(401);
  });

  it("rejects expired token", async () => {
    const token = "expired-token";
    prismaMock.cliToken.findUnique.mockResolvedValue({
      id: "token-1",
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const req = new NextRequest("http://localhost", {
      headers: { authorization: `Bearer ${token}` },
    });
    const { response } = await requireCliToken(req);
    expect(response?.status).toBe(401);
  });

  it("accepts valid token and updates lastUsedAt", async () => {
    const token = "valid-token";
    const tokenRecord = {
      id: "token-1",
      userId: "user-1",
      tokenHash: hashToken(token),
      scopes: ["cli:read"],
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    };
    prismaMock.cliToken.findUnique.mockResolvedValue(tokenRecord);
    prismaMock.cliToken.update.mockResolvedValue(tokenRecord);

    const req = new NextRequest("http://localhost", {
      headers: { authorization: `Bearer ${token}` },
    });
    const { token: resultToken, response } = await requireCliToken(req, ["cli:read"]);
    
    expect(response).toBeUndefined();
    expect(resultToken?.id).toBe("token-1");
    expect(prismaMock.cliToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("rejects token with missing scopes", async () => {
    const token = "limited-token";
    prismaMock.cliToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      tokenHash: hashToken(token),
      scopes: ["cli:read"],
      revokedAt: null,
      expiresAt: null,
    });
    const req = new NextRequest("http://localhost", {
      headers: { authorization: `Bearer ${token}` },
    });
    const { response } = await requireCliToken(req, ["cli:upload"]);
    expect(response?.status).toBe(403);
    const json = await response?.json();
    expect(json.error).toBe("Missing scopes");
    expect(json.missing).toEqual(["cli:upload"]);
  });
});
