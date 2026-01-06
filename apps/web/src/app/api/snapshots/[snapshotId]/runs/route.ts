import { NextResponse } from "next/server";
import { z } from "zod";
import type { Run } from "@prisma/client";
import { Prisma, RunStatus, RunType } from "@prisma/client";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal } from "@/lib/reports";
import { requireCliToken } from "@/lib/requireCliToken";
import { runWorker, type WorkerRunRequest } from "@/lib/engine/workerClient";
import { emitRunEvent } from "@/lib/events/runEvents";
import { safeRevalidateTag } from "@/lib/revalidate";
import { cacheTags } from "@/lib/cacheTags";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ snapshotId: string }> };

const RUN_LIMITS = {
  list: { windowMs: 60_000, maxRequests: 120 },
  create: { windowMs: 60_000, maxRequests: 30 },
};

const RunCreateSchema = z.object({
  type: z.enum(["audit", "suggest"]),
  timeoutMs: z.number().int().positive().max(10 * 60_000).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function parseRunType(value: string | null): RunType | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  if (upper in RunType) {
    return RunType[upper as keyof typeof RunType];
  }
  return undefined;
}

function serializeRun(run: Run) {
  return {
    id: run.id,
    snapshotId: run.snapshotId,
    type: run.type,
    status: run.status,
    input: run.input ?? undefined,
    output: run.output ?? undefined,
    error: run.error ?? undefined,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

export async function GET(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    const limitResponse = await checkRateLimit(`cli-runs:list:${ip}`, RUN_LIMITS.list);
    if (limitResponse) {
      logAbuseSignal({ ip, reason: "cli-runs-list-rate-limit", traceId });
      return limitResponse;
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Runs unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:read"]);
    if (response) return response;

    const userLimitResponse = await checkRateLimit(`cli-runs:list:user:${token.userId}`, RUN_LIMITS.list);
    if (userLimitResponse) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-runs-list-user-rate-limit", traceId });
      return userLimitResponse;
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
    const type = parseRunType(url.searchParams.get("type"));
    if (url.searchParams.get("type") && !type) {
      return NextResponse.json({ error: "Invalid run type" }, { status: 422 });
    }

    const runs = await prisma.run.findMany({
      where: { snapshotId, ...(type ? { type } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ runs: runs.map(serializeRun) });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    const limitResponse = await checkRateLimit(`cli-runs:create:${ip}`, RUN_LIMITS.create);
    if (limitResponse) {
      logAbuseSignal({ ip, reason: "cli-runs-create-rate-limit", traceId });
      return limitResponse;
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Runs unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:run"]);
    if (response) return response;

    const userLimitResponse = await checkRateLimit(`cli-runs:create:user:${token.userId}`, RUN_LIMITS.create);
    if (userLimitResponse) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-runs-create-user-rate-limit", traceId });
      return userLimitResponse;
    }

    const body = await request.json().catch(() => null);
    const parsed = RunCreateSchema.safeParse(body);
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
    if (snapshot.status !== "READY") {
      return NextResponse.json({ error: "Snapshot is not ready for runs" }, { status: 409 });
    }

    const runType = parsed.data.type.toUpperCase() as RunType;
    const existing = await prisma.run.findFirst({
      where: {
        snapshotId,
        type: runType,
        status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({ run: serializeRun(existing) });
    }

    const inputPayload = parsed.data.input ?? {};
    const runInput = {
      ...inputPayload,
      snapshot: { id: snapshot.id, projectId: snapshot.projectId },
    };

    let run = await prisma.run.create({
      data: {
        snapshotId,
        type: runType,
        status: RunStatus.QUEUED,
        input: runInput,
      },
    });

    auditLog("cli_snapshot_run_queued", {
      ip,
      traceId,
      userId: token.userId,
      projectId: snapshot.projectId,
      snapshotId: snapshot.id,
      runId: run.id,
      type: run.type,
    });

    emitRunEvent({
      runId: run.id,
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      status: run.status,
      type: run.type,
      traceId,
    });

    run = await prisma.run.update({
      where: { id: run.id },
      data: { status: RunStatus.RUNNING, startedAt: new Date() },
    });

    emitRunEvent({
      runId: run.id,
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      status: run.status,
      type: run.type,
      traceId,
    });

    const workerPayload: WorkerRunRequest = {
      ...inputPayload,
      id: run.id,
      type: run.type.toLowerCase() as Lowercase<RunType>,
      timeoutMs: parsed.data.timeoutMs,
    };

    const result = await runWorker(workerPayload);
    const finishedAt = new Date();

    if (!result.ok) {
      run = await prisma.run.update({
        where: { id: run.id },
        data: { status: RunStatus.FAILED, error: result.error?.message ?? "Run failed", finishedAt },
      });

      emitRunEvent({
        runId: run.id,
        snapshotId: snapshot.id,
        projectId: snapshot.projectId,
        status: run.status,
        type: run.type,
        traceId,
        error: run.error ?? undefined,
      });

      safeRevalidateTag(cacheTags.snapshot(snapshotId));
      safeRevalidateTag(cacheTags.snapshotRuns(snapshotId));

      return NextResponse.json({ error: run.error ?? "Run failed", run: serializeRun(run) }, { status: 502 });
    }

    const output = result.audit?.output ?? result.suggest?.output ?? Prisma.JsonNull;
    run = await prisma.run.update({
      where: { id: run.id },
      data: { status: RunStatus.SUCCESS, output, finishedAt },
    });

    emitRunEvent({
      runId: run.id,
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      status: run.status,
      type: run.type,
      traceId,
    });

    safeRevalidateTag(cacheTags.snapshot(snapshotId));
    safeRevalidateTag(cacheTags.snapshotRuns(snapshotId));

    return NextResponse.json({ run: serializeRun(run) });
  });
}
