import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { MAX_CLI_TOKEN_LABEL_LENGTH } from "@/lib/validation";

export const CLI_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ALLOWED_CLI_SCOPES = ["cli:read", "cli:upload", "cli:run", "cli:patch"] as const;
export const DEFAULT_CLI_SCOPES = ["cli:read", "cli:upload"] as const;

const ALLOWED_SCOPE_SET = new Set<string>(ALLOWED_CLI_SCOPES);
const TOKEN_BYTES = 32;

type CliTokenClient = Pick<typeof prisma, "cliToken">;

export type IssuedCliToken = {
  token: string;
  tokenId: string;
  scopes: string[];
  expiresAt: Date;
};

export function normalizeScopes(input?: string[] | null): { scopes: string[]; error?: string } {
  if (!input || input.length === 0) {
    return { scopes: [...DEFAULT_CLI_SCOPES] };
  }

  const cleaned = input
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return { scopes: [...DEFAULT_CLI_SCOPES] };
  }

  const unknown = cleaned.filter((scope) => !ALLOWED_SCOPE_SET.has(scope));
  if (unknown.length > 0) {
    return { scopes: [], error: `Unknown scopes: ${unknown.join(", ")}` };
  }

  const requested = new Set(cleaned);
  const ordered = ALLOWED_CLI_SCOPES.filter((scope) => requested.has(scope));

  return { scopes: ordered };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function normalizeLabel(label?: string | null): string | undefined {
  if (!label) return undefined;
  const trimmed = label.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= MAX_CLI_TOKEN_LABEL_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_CLI_TOKEN_LABEL_LENGTH);
}

export async function issueCliToken(options: {
  userId: string;
  scopes: string[];
  label?: string | null;
  client?: CliTokenClient;
  expiresAt?: Date;
}): Promise<IssuedCliToken> {
  const { userId, scopes, label, client, expiresAt } = options;
  const token = generateToken();
  const tokenHash = hashToken(token);
  const effectiveExpiresAt = expiresAt ?? new Date(Date.now() + CLI_TOKEN_TTL_MS);
  const db = client ?? prisma;

  const record = await db.cliToken.create({
    data: {
      userId,
      tokenHash,
      scopes,
      label: normalizeLabel(label),
      expiresAt: effectiveExpiresAt,
    },
  });

  return { token, tokenId: record.id, scopes: record.scopes, expiresAt: record.expiresAt ?? effectiveExpiresAt };
}
