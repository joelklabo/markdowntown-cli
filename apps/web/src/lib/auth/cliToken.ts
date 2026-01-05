import type { CliToken } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyTokenHash } from "@/lib/cli/tokens";

const AUTH_SCHEME = "bearer";

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== AUTH_SCHEME) return null;
  return value.trim();
}

/**
 * Find and verify a CLI token.
 * Returns null if token not found, revoked, or expired.
 */
export async function findCliToken(token: string): Promise<CliToken | null> {
  // We don't know the hash yet, so we need to find by prefix first (if we had it)
  // OR we hash and lookup. Current schema requires hash lookup.
  // Actually, we should just hash it and look up by tokenHash.
  // Then verify with constant-time compare.
  
  // For efficiency, we could add an index on tokenPrefix and do a prefix lookup first
  // to narrow down candidates, then verify with constant-time compare.
  // But for now, let's just hash and lookup by unique tokenHash.
  
  const { hashToken } = await import("@/lib/cli/tokens");
  const tokenHash = hashToken(token);
  const record = await prisma.cliToken.findUnique({ where: { tokenHash } });
  
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return null;
  
  // Verify with constant-time compare to prevent timing attacks
  if (!verifyTokenHash(token, record.tokenHash)) return null;
  
  return record;
}

export function isCliTokenExpired(token: CliToken): boolean {
  return Boolean(token.expiresAt && token.expiresAt.getTime() <= Date.now());
}

export function getMissingCliScopes(token: CliToken, scopes: string[]): string[] {
  if (!scopes.length) return [];
  const required = new Set(scopes);
  const allowed = token.scopes ?? [];
  return Array.from(required).filter((scope) => !allowed.includes(scope));
}

export async function getUserCliTokens(userId: string) {
  return prisma.cliToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      tokenPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      scopes: true,
    },
  });
}

export async function revokeCliToken(userId: string, tokenId: string) {
  return prisma.cliToken.update({
    where: { id: tokenId, userId },
    data: { revokedAt: new Date() },
  });
}
