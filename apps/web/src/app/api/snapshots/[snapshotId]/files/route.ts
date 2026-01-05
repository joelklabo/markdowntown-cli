import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { CLI_SNAPSHOT_LIMITS, rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";
import { requireCliToken } from "@/lib/requireCliToken";
import { validateBlobUpload, validateUploadManifest } from "@/lib/cli/validation";
import { getBlobStore } from "@/lib/storage";
import { MAX_SNAPSHOT_FILES, MAX_SNAPSHOT_TOTAL_BYTES } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ snapshotId: string }> };

const FileSchema = z.object({
  path: z.string().min(1).max(4096),
  blobHash: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  contentBase64: z.string().optional(),
  contentType: z.string().max(200).optional(),
  isBinary: z.boolean().optional(),
  mode: z.number().int().optional(),
  mtime: z.union([z.string(), z.number()]).optional(),
  isDeleted: z.boolean().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function parseLimit(raw: string | null, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 5_000);
}

function normalizeMtime(value?: string | number | null): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeFile(file: {
  id: string;
  snapshotId: string;
  path: string;
  sizeBytes: number;
  contentType: string | null;
  isBinary: boolean;
  mode: number | null;
  mtime: Date | null;
  orderIndex: number;
  isDeleted: boolean;
  deletedAt: Date | null;
  blob: { sha256: string };
}, contentBase64?: string | null) {
  return {
    id: file.id,
    snapshotId: file.snapshotId,
    path: file.path,
    blobHash: file.blob.sha256,
    sizeBytes: file.sizeBytes,
    contentType: file.contentType,
    isBinary: file.isBinary,
    mode: file.mode,
    mtime: file.mtime,
    orderIndex: file.orderIndex,
    isDeleted: file.isDeleted,
    deletedAt: file.deletedAt,
    contentBase64: contentBase64 ?? undefined,
  };
}

export async function GET(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    if (!rateLimit(`cli-snapshots-files:get:${ip}`, CLI_SNAPSHOT_LIMITS.list)) {
      logAbuseSignal({ ip, reason: "cli-snapshots-files-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshot files unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request);
    if (response) return response;
    if (!rateLimit(`cli-snapshots-files:get:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.list)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-snapshots-files-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { snapshotId } = await context.params;
    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, project: { userId: token.userId } },
      select: { id: true },
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const includeContent = url.searchParams.get("includeContent") === "1";

    if (path) {
      const file = await prisma.snapshotFile.findFirst({
        where: { snapshotId, path },
        include: { blob: { select: { sha256: true } } },
      });
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      if (includeContent && !file.isDeleted) {
        const store = getBlobStore();
        const blob = await store.getBlob(file.blob.sha256);
        if (!blob) {
          return NextResponse.json({ error: "Blob not found" }, { status: 404 });
        }
        return NextResponse.json({ file: serializeFile(file, blob.toString("base64")) });
      }

      return NextResponse.json({ file: serializeFile(file) });
    }

    const limit = parseLimit(url.searchParams.get("limit"), MAX_SNAPSHOT_FILES);
    const cursor = url.searchParams.get("cursor");

    const files = await prisma.snapshotFile.findMany({
      where: { snapshotId },
      orderBy: [{ orderIndex: "asc" }, { path: "asc" }],
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { snapshotId_path: { snapshotId, path: cursor } } : undefined,
      include: { blob: { select: { sha256: true } } },
    });

    return NextResponse.json({
      files: files.map((file) => serializeFile(file)),
      nextCursor: files.length === limit ? files[files.length - 1].path : undefined,
    });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    if (!rateLimit(`cli-snapshots-files:post:${ip}`, CLI_SNAPSHOT_LIMITS.files)) {
      logAbuseSignal({ ip, reason: "cli-snapshots-files-upload-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshot files unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:upload"]);
    if (response) return response;
    if (!rateLimit(`cli-snapshots-files:post:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.files)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-snapshots-files-upload-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = FileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 422 });
    }

    const { snapshotId } = await context.params;
    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, project: { userId: token.userId } },
      select: { id: true, projectId: true, status: true },
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }
    if (snapshot.status !== "UPLOADING") {
      return NextResponse.json({ error: "Snapshot is not accepting uploads" }, { status: 409 });
    }

    const input = parsed.data;
    const manifestError = validateUploadManifest([
      {
        path: input.path,
        blobHash: input.blobHash,
        sizeBytes: input.sizeBytes,
        mode: input.mode,
        mtime: input.mtime,
        isDeleted: input.isDeleted,
        contentType: input.contentType,
        isBinary: input.isBinary,
      },
    ]);
    if (manifestError) {
      // Determine appropriate status code based on error message content
      const status = manifestError.includes("exceeds") || manifestError.includes("too large") ? 413 : 422;
      return NextResponse.json({ error: manifestError }, { status });
    }

    const isDeleted = Boolean(input.isDeleted);
    if (!isDeleted && !input.contentBase64) {
      return NextResponse.json({ error: "Missing blob content" }, { status: 422 });
    }

    const existingFile = await prisma.snapshotFile.findFirst({
      where: { snapshotId, path: input.path },
      select: { id: true, sizeBytes: true, isDeleted: true, orderIndex: true },
    });

    const aggregate = await prisma.snapshotFile.aggregate({
      where: { snapshotId, isDeleted: false },
      _sum: { sizeBytes: true },
      _count: true,
    });

    let totalBytes = aggregate._sum.sizeBytes ?? 0;
    let fileCount = aggregate._count ?? 0;
    if (existingFile && !existingFile.isDeleted) {
      totalBytes -= existingFile.sizeBytes;
      fileCount -= 1;
    }

    if (!isDeleted) {
      totalBytes += input.sizeBytes;
      fileCount += 1;
    }

    if (fileCount > MAX_SNAPSHOT_FILES) {
      return NextResponse.json(
        { error: `Snapshot exceeds file limit (max ${MAX_SNAPSHOT_FILES})` },
        { status: 413 }
      );
    }

    if (totalBytes > MAX_SNAPSHOT_TOTAL_BYTES) {
      return NextResponse.json(
        { error: `Snapshot exceeds total size limit (max ${MAX_SNAPSHOT_TOTAL_BYTES} bytes)` },
        { status: 413 }
      );
    }

    const blobValidation = validateBlobUpload({
      sha256: input.blobHash,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      path: input.path,
    });
    if (blobValidation) {
      const status = blobValidation.includes("exceeds") ? 413 : 422;
      return NextResponse.json({ error: blobValidation }, { status });
    }

    let content: Buffer | null = null;
    let storageKey: string | null = null;
    if (!isDeleted && input.contentBase64) {
      content = Buffer.from(input.contentBase64, "base64");
      if (content.length !== input.sizeBytes) {
        return NextResponse.json({ error: "Blob size mismatch" }, { status: 422 });
      }
      const computedHash = createHash("sha256").update(content).digest("hex");
      if (computedHash !== input.blobHash) {
        return NextResponse.json({ error: "Blob hash mismatch" }, { status: 422 });
      }

      const store = getBlobStore();
      const stored = await store.putBlob({
        sha256: input.blobHash,
        sizeBytes: input.sizeBytes,
        content,
        contentType: input.contentType ?? null,
      });
      storageKey = stored.storageKey ?? null;
    }

    const existingBlob = await prisma.blob.findUnique({ where: { sha256: input.blobHash } });
    if (existingBlob && existingBlob.sizeBytes !== input.sizeBytes) {
      return NextResponse.json({ error: "Blob size mismatch" }, { status: 409 });
    }

    const blob = await prisma.blob.upsert({
      where: { sha256: input.blobHash },
      create: {
        sha256: input.blobHash,
        sizeBytes: input.sizeBytes,
        content: storageKey ? null : content,
        storageKey,
      },
      update: {
        sizeBytes: input.sizeBytes,
        content: existingBlob?.content ?? (storageKey ? null : content),
        storageKey: existingBlob?.storageKey ?? storageKey,
      },
    });

    const resolvedOrderIndex = input.orderIndex ?? existingFile?.orderIndex ?? 0;

    const createData: Prisma.SnapshotFileUncheckedCreateInput = {
      snapshotId,
      path: input.path,
      blobId: blob.id,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType ?? null,
      isBinary: Boolean(input.isBinary),
      mode: input.mode ?? null,
      mtime: normalizeMtime(input.mtime),
      orderIndex: resolvedOrderIndex,
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
    };

    const updateData: Prisma.SnapshotFileUncheckedUpdateInput = {
      blobId: blob.id,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType ?? null,
      isBinary: Boolean(input.isBinary),
      mode: input.mode ?? null,
      mtime: normalizeMtime(input.mtime),
      orderIndex: resolvedOrderIndex,
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
    };

    const snapshotFile = await prisma.snapshotFile.upsert({
      where: { snapshotId_path: { snapshotId, path: input.path } },
      create: createData,
      update: updateData,
      include: { blob: { select: { sha256: true } } },
    });

    auditLog("cli_snapshot_file_upload", {
      ip,
      traceId,
      userId: token.userId,
      projectId: snapshot.projectId,
      snapshotId,
      path: input.path,
      blobHash: input.blobHash,
      sizeBytes: input.sizeBytes,
    });
    logAuditEvent({
      event: "cli_snapshot_file_upload",
      ip,
      traceId,
      userId: token.userId,
      projectId: snapshot.projectId,
      snapshotId,
      metadata: {
        path: input.path,
        blobHash: input.blobHash,
        sizeBytes: input.sizeBytes,
      },
    });

    return NextResponse.json({ file: serializeFile(snapshotFile) });
  });
}
