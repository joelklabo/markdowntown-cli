import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { SnapshotStatus } from "@prisma/client";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { CLI_SNAPSHOT_LIMITS, checkRateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";
import { requireCliToken } from "@/lib/requireCliToken";
import { MAX_SNAPSHOT_METADATA_BYTES } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

const SnapshotCreateSchema = z.object({
  baseSnapshotId: z.string().min(1).max(64).optional(),
  repoRoot: z.string().min(1).max(1024).optional(),
  protocolVersion: z.string().min(1).max(64).optional(),
  idempotencyKey: z.string().min(1).max(120).optional(),
  manifestHash: z.string().min(1).max(128).optional(),
  metadata: z.unknown().optional(),
  source: z.string().min(1).max(64).optional(),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function parseSnapshotStatus(value: string | null): SnapshotStatus | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  if (upper in SnapshotStatus) {
    return SnapshotStatus[upper as keyof typeof SnapshotStatus];
  }
  return undefined;
}

function parseLimit(raw: string | null, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function serializeSnapshot(snapshot: {
  id: string;
  projectId: string;
  baseSnapshotId: string | null;
  source: string | null;
  repoRoot: string | null;
  manifestHash: string | null;
  protocolVersion: string | null;
  idempotencyKey: string | null;
  status: SnapshotStatus;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { files: number; runs: number; patches: number; auditIssues: number };
}) {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    baseSnapshotId: snapshot.baseSnapshotId,
    source: snapshot.source,
    repoRoot: snapshot.repoRoot,
    manifestHash: snapshot.manifestHash,
    protocolVersion: snapshot.protocolVersion,
    idempotencyKey: snapshot.idempotencyKey,
    status: snapshot.status,
    finalizedAt: snapshot.finalizedAt,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    counts: snapshot._count ?? undefined,
  };
}

export async function GET(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    const limitResponse = await checkRateLimit(`cli-snapshots:list:${ip}`, CLI_SNAPSHOT_LIMITS.list);
    if (limitResponse) {
      logAbuseSignal({ ip, reason: "cli-snapshots-list-rate-limit", traceId });
      return limitResponse;
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshots unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:read"]);
    if (response) return response;

    const userLimitResponse = await checkRateLimit(`cli-snapshots:list:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.list);
    if (userLimitResponse) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-snapshots-list-user-rate-limit", traceId });
      return userLimitResponse;
    }

    const { projectId } = await context.params;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: token.userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const status = parseSnapshotStatus(url.searchParams.get("status"));
    if (url.searchParams.get("status") && !status) {
      return NextResponse.json({ error: "Invalid status" }, { status: 422 });
    }

    const limit = parseLimit(url.searchParams.get("limit"), 50);
    const snapshots = await prisma.snapshot.findMany({
      where: {
        projectId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        projectId: true,
        baseSnapshotId: true,
        source: true,
        repoRoot: true,
        manifestHash: true,
        protocolVersion: true,
        idempotencyKey: true,
        status: true,
        finalizedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            files: true,
            runs: true,
            patches: true,
            auditIssues: true,
          },
        },
      },
    });

    return NextResponse.json({ snapshots: snapshots.map(serializeSnapshot) });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    const limitResponse = await checkRateLimit(`cli-snapshots:create:${ip}`, CLI_SNAPSHOT_LIMITS.create);
    if (limitResponse) {
      logAbuseSignal({ ip, reason: "cli-snapshots-create-rate-limit", traceId });
      return limitResponse;
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshots unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:upload"]);
    if (response) return response;

    const userLimitResponse = await checkRateLimit(`cli-snapshots:create:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.create);
    if (userLimitResponse) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-snapshots-create-user-rate-limit", traceId });
      return userLimitResponse;
    }

    const body = await request.json().catch(() => null);
    const parsed = SnapshotCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 422 });
    }

    const { projectId } = await context.params;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: token.userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const metadataJson = parsed.data.metadata;
    if (metadataJson !== undefined) {
      const encoded = JSON.stringify(metadataJson);
      if (encoded.length > MAX_SNAPSHOT_METADATA_BYTES) {
        return NextResponse.json(
          { error: `Metadata exceeds size limit (max ${MAX_SNAPSHOT_METADATA_BYTES} bytes)` },
          { status: 413 }
        );
      }
    }

    if (parsed.data.baseSnapshotId) {
      const baseSnapshot = await prisma.snapshot.findFirst({
        where: { id: parsed.data.baseSnapshotId, projectId },
      });
      if (!baseSnapshot) {
        return NextResponse.json({ error: "Base snapshot not found" }, { status: 404 });
      }
    }

    if (parsed.data.idempotencyKey) {
      const existing = await prisma.snapshot.findFirst({
        where: { projectId, idempotencyKey: parsed.data.idempotencyKey },
      });
      if (existing) {
        if (
          parsed.data.manifestHash &&
          existing.manifestHash &&
          parsed.data.manifestHash !== existing.manifestHash
        ) {
          return NextResponse.json({ error: "Manifest hash mismatch for idempotent snapshot" }, { status: 409 });
        }
        return NextResponse.json({ snapshot: serializeSnapshot(existing) });
      }
    }

    const snapshot = await prisma.snapshot.create({
      data: {
        projectId,
        baseSnapshotId: parsed.data.baseSnapshotId ?? null,
        repoRoot: parsed.data.repoRoot ?? null,
        manifestHash: parsed.data.manifestHash ?? null,
        protocolVersion: parsed.data.protocolVersion ?? null,
        idempotencyKey: parsed.data.idempotencyKey ?? null,
        metadata: metadataJson as Prisma.InputJsonValue | undefined,
        source: parsed.data.source ?? "cli",
        status: "UPLOADING",
      },
    });

    auditLog("cli_snapshot_create", {
      ip,
      traceId,
      userId: token.userId,
      projectId,
      snapshotId: snapshot.id,
    });
    logAuditEvent({
      event: "cli_snapshot_create",
      ip,
      traceId,
      userId: token.userId,
      projectId,
      snapshotId: snapshot.id,
    });

    return NextResponse.json({ snapshot: serializeSnapshot(snapshot) });
  });
}
