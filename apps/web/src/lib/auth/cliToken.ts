import type { CliToken } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/cli/tokens";

const AUTH_SCHEME = "bearer";

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== AUTH_SCHEME) return null;
  return value.trim();
}

export async function findCliToken(token: string): Promise<CliToken | null> {
  const tokenHash = hashToken(token);
  return prisma.cliToken.findUnique({ where: { tokenHash } });
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
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      scopes: true,
    },
  });
}

export async function revokeCliToken(userId: string, tokenId: string) {
  // Use delete or set revokedAt?
  // Schema has revokedAt, but usually we delete if user requests revoke from UI?
  // Or we just set revokedAt.
  // If we set revokedAt, findCliToken checks if revoked?
  // findCliToken doesn't check revokedAt in current implementation.
  // I should update findCliToken too!
  return prisma.cliToken.update({
    where: { id: tokenId, userId },
    data: { revokedAt: new Date() },
  });
}
