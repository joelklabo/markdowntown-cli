import path from "node:path";
import { Prisma } from "@prisma/client";
import type { Patch, PatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SHA256_REGEX = /^[a-f0-9]{64}$/i;
const PATCH_FORMAT_REGEX = /^[a-z0-9][a-z0-9+._-]{0,63}$/i;
const MAX_PATH_LENGTH = 4096;
const MAX_IDEMPOTENCY_KEY_LENGTH = 120;

export type PatchInput = {
  snapshotId: string;
  path: string;
  baseBlobHash: string;
  patchFormat: string;
  patchBody: string;
  idempotencyKey?: string | null;
};

export type PatchQuery = {
  userId: string;
  snapshotId: string;
  status?: PatchStatus;
  limit?: number;
  cursor?: string;
};

export type PatchListResult = {
  patches: Patch[];
  nextCursor: string | null;
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export type PatchFetch = {
  userId: string;
  patchId: string;
};

export function normalizeRepoPath(value: string): { path: string; error?: string } {
  const cleaned = value.replace(/\\/g, "/").trim();
  if (!cleaned) {
    return { path: "", error: "Path is required" };
  }
  if (cleaned.length > MAX_PATH_LENGTH) {
    return { path: "", error: `Path is too long (max ${MAX_PATH_LENGTH} characters)` };
  }
  if (cleaned.includes("\0") || cleaned.includes("\n") || cleaned.includes("\r")) {
    return { path: "", error: "Path contains invalid characters" };
  }
  if (cleaned.startsWith("/") || cleaned.startsWith("\\")) {
    return { path: "", error: "Path must be relative" };
  }
  if (/^[A-Za-z]:/.test(cleaned)) {
    return { path: "", error: "Path must be relative" };
  }
  if (/(^|\/)\.\.(\/|$)/.test(cleaned)) {
    return { path: "", error: "Path traversal detected" };
  }

  const normalized = path.posix.normalize(cleaned);
  if (normalized.startsWith("..") || normalized === ".") {
    return { path: "", error: "Path traversal detected" };
  }

  return { path: normalized };
}

export function validateRepoPath(value: string): string | null {
  const result = normalizeRepoPath(value);
  return result.error ?? null;
}

function normalizeIdempotencyKey(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_IDEMPOTENCY_KEY_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
}

function normalizePatchInput(input: PatchInput): {
  snapshotId: string;
  path: string;
  baseBlobHash: string;
  patchFormat: string;
  patchBody: string;
  idempotencyKey: string | null;
} {
  const pathResult = normalizeRepoPath(input.path);
  if (pathResult.error) {
    throw new Error(pathResult.error);
  }

  const baseBlobHash = input.baseBlobHash.trim();
  if (!SHA256_REGEX.test(baseBlobHash)) {
    throw new Error("Invalid base blob hash");
  }

  const patchFormat = input.patchFormat.trim();
  if (!patchFormat) {
    throw new Error("Patch format is required");
  }
  if (!PATCH_FORMAT_REGEX.test(patchFormat)) {
    throw new Error("Invalid patch format");
  }

  if (!input.patchBody) {
    throw new Error("Patch body is required");
  }

  return {
    snapshotId: input.snapshotId,
    path: pathResult.path,
    baseBlobHash,
    patchFormat,
    patchBody: input.patchBody,
    idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
  };
}

export function validatePatchInput(input: PatchInput): string | null {
  try {
    normalizePatchInput(input);
    return null;
  } catch (error) {
    if (error instanceof Error) return error.message;
    return "Invalid patch input";
  }
}

export async function createPatch(options: { userId: string; input: PatchInput }): Promise<Patch> {
  const normalized = normalizePatchInput(options.input);

  const snapshot = await prisma.snapshot.findFirst({
    where: { id: normalized.snapshotId, project: { userId: options.userId } },
  });
  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  if (normalized.idempotencyKey) {
    const existing = await prisma.patch.findFirst({
      where: { snapshotId: normalized.snapshotId, idempotencyKey: normalized.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  try {
    return await prisma.patch.create({
      data: {
        snapshotId: normalized.snapshotId,
        path: normalized.path,
        baseBlobHash: normalized.baseBlobHash,
        patchFormat: normalized.patchFormat,
        patchBody: normalized.patchBody,
        idempotencyKey: normalized.idempotencyKey,
      },
    });
  } catch (error) {
    if (
      normalized.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.patch.findFirst({
        where: { snapshotId: normalized.snapshotId, idempotencyKey: normalized.idempotencyKey },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function listPatches(options: PatchQuery): Promise<PatchListResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const take = limit + 1; // fetch one extra to determine if there's more

  const patches = await prisma.patch.findMany({
    where: {
      snapshotId: options.snapshotId,
      status: options.status,
      snapshot: { project: { userId: options.userId } },
      ...(options.cursor ? { id: { gt: options.cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take,
  });

  const hasMore = patches.length > limit;
  const items = hasMore ? patches.slice(0, limit) : patches;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

  return { patches: items, nextCursor };
}

export async function getPatch(options: PatchFetch): Promise<Patch | null> {
  return prisma.patch.findFirst({
    where: { id: options.patchId, snapshot: { project: { userId: options.userId } } },
  });
}
