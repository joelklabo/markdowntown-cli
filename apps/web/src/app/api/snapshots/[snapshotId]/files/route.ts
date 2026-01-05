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
import { shouldWriteBlob } from "@/lib/storage/blobStore";
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

    if (!(await rateLimit(`cli-snapshots-files:get:${ip}`, CLI_SNAPSHOT_LIMITS.list))) {
      logAbuseSignal({ ip, reason: "cli-snapshots-files-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshot files unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:read"]);
    if (response) return response;
    if (!(await rateLimit(`cli-snapshots-files:get:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.list))) {
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

    if (!(await rateLimit(`cli-snapshots-files:post:${ip}`, CLI_SNAPSHOT_LIMITS.files))) {
      logAbuseSignal({ ip, reason: "cli-snapshots-files-upload-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshot files unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:upload"]);
    if (response) return response;
    if (!(await rateLimit(`cli-snapshots-files:post:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.files))) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-snapshots-files-upload-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = FileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 422 });
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

    const { snapshotId } = await context.params;
    const snapshotRecord = await prisma.snapshot.findFirst({
      where: { id: snapshotId, project: { userId: token.userId } },
      select: { id: true, projectId: true, status: true },
    });
    if (!snapshotRecord) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }
    if (snapshotRecord.status !== "UPLOADING") {
      return NextResponse.json({ error: "Snapshot is not accepting uploads" }, { status: 409 });
    }

    const isDeleted = Boolean(input.isDeleted);
    if (!isDeleted && !input.contentBase64) {
      return NextResponse.json({ error: "Missing blob content" }, { status: 422 });
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
    }

    const existingBlob = await prisma.blob.findUnique({
      where: { sha256: input.blobHash },
      select: { id: true, sizeBytes: true, content: true, storageKey: true },
    });
    if (existingBlob && existingBlob.sizeBytes !== input.sizeBytes) {
      return NextResponse.json({ error: "Blob size mismatch" }, { status: 409 });
    }

    if (!isDeleted && content && shouldWriteBlob(existingBlob)) {
      const store = getBlobStore();
      const stored = await store.putBlob({
        sha256: input.blobHash,
        sizeBytes: input.sizeBytes,
        content,
        contentType: input.contentType ?? null,
      });
      storageKey = stored.storageKey ?? null;
    } else {
      storageKey = existingBlob?.storageKey ?? null;
    }

    type UploadResult =
      | { error: { status: number; message: string } }
      | {
          snapshot: { id: string; projectId: string; status: string };
          snapshotFile: {
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
          };
        };

    const result: UploadResult = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.snapshot.findFirst({
        where: { id: snapshotId, project: { userId: token.userId } },
        select: { id: true, projectId: true, status: true },
      });
      if (!snapshot) {
        return { error: { status: 404, message: "Snapshot not found" } } as const;
      }
      if (snapshot.status !== "UPLOADING") {
        return { error: { status: 409, message: "Snapshot is not accepting uploads" } } as const;
      }

      const existingFile = await tx.snapshotFile.findFirst({
        where: { snapshotId, path: input.path },
        select: { id: true, sizeBytes: true, isDeleted: true, orderIndex: true },
      });

      const aggregate = await tx.snapshotFile.aggregate({
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
        return {
          error: { status: 413, message: `Snapshot exceeds file limit (max ${MAX_SNAPSHOT_FILES})` },
        } as const;
      }

      if (totalBytes > MAX_SNAPSHOT_TOTAL_BYTES) {
        return {
          error: {
            status: 413,
            message: `Snapshot exceeds total size limit (max ${MAX_SNAPSHOT_TOTAL_BYTES} bytes)`,
          },
        } as const;
      }

      const blobRecord = await tx.blob.findUnique({ where: { sha256: input.blobHash } });
      if (blobRecord && blobRecord.sizeBytes !== input.sizeBytes) {
        return { error: { status: 409, message: "Blob size mismatch" } } as const;
      }

      const resolvedStorageKey = blobRecord?.storageKey ?? storageKey;
      const resolvedContent = blobRecord?.content ?? (resolvedStorageKey ? null : content);

      const blob = await tx.blob.upsert({
        where: { sha256: input.blobHash },
        create: {
          sha256: input.blobHash,
          sizeBytes: input.sizeBytes,
          content: resolvedStorageKey ? null : resolvedContent,
          storageKey: resolvedStorageKey ?? null,
        },
        update: {
          sizeBytes: input.sizeBytes,
          content: resolvedContent,
          storageKey: blobRecord?.storageKey ?? resolvedStorageKey,
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

      const snapshotFile = await tx.snapshotFile.upsert({
        where: { snapshotId_path: { snapshotId, path: input.path } },
        create: createData,
        update: updateData,
        include: { blob: { select: { sha256: true } } },
      });

      return { snapshot, snapshotFile };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status });
    }

    const { snapshot, snapshotFile } = result;

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
