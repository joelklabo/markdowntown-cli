import { NextResponse } from "next/server";
import { z } from "zod";
import { PatchStatus } from "@prisma/client";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";
import { requireCliToken } from "@/lib/cli/upload";
import { createPatch, getPatch, listPatches } from "@/lib/cli/patches";
import { MAX_PATCH_BODY_BYTES } from "@/lib/validation";

export const dynamic = "force-dynamic";

type SerializedPatch = {
  id: string;
  snapshotId: string;
  path: string;
  baseBlobHash: string;
  patchFormat: string;
  status: PatchStatus;
  createdAt: Date;
  appliedAt: Date | null;
  patchBody?: string;
};

type PatchListResponse = { patches: SerializedPatch[]; nextCursor: string | null };
type PatchResponse = { patch: SerializedPatch };
type PatchErrorResponse = { error: string; details?: unknown };

const PatchSchema = z.object({
  snapshotId: z.string().min(1),
  path: z.string().min(1).max(4096),
  baseBlobHash: z.string().min(1).max(128),
  patchFormat: z.string().min(1).max(64),
  patchBody: z.string().min(1),
  idempotencyKey: z.string().max(120).optional(),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function parsePatchStatus(value: string | null): PatchStatus | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper in PatchStatus) {
    return PatchStatus[upper as keyof typeof PatchStatus];
  }
  return undefined;
}

function wantsRaw(format: string | null) {
  if (!format) return false;
  const normalized = format.trim().toLowerCase();
  return normalized === "raw" || normalized === "patch" || normalized === "diff";
}

function wantsBody(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function serializePatch(
  patch: {
    id: string;
    snapshotId: string;
    path: string;
    baseBlobHash: string;
    patchFormat: string;
    patchBody: string;
    status: PatchStatus;
    createdAt: Date;
    appliedAt: Date | null;
  },
  includeBody: boolean,
): SerializedPatch {
  const payload: SerializedPatch = {
    id: patch.id,
    snapshotId: patch.snapshotId,
    path: patch.path,
    baseBlobHash: patch.baseBlobHash,
    patchFormat: patch.patchFormat,
    status: patch.status,
    createdAt: patch.createdAt,
    appliedAt: patch.appliedAt,
  };

  if (includeBody) {
    payload.patchBody = patch.patchBody;
  }

  return payload;
}

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;
    if (!(await rateLimit(`cli-patches:${ip}`))) {
      logAbuseSignal({ ip, reason: "cli-patches-rate-limit", traceId });
      return NextResponse.json<PatchErrorResponse>({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json<PatchErrorResponse>({ error: "CLI patches unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:patch"]);
    if (response) return response;
    if (!(await rateLimit(`cli-patches:user:${token.userId}`))) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-patches-user-rate-limit", traceId });
      return NextResponse.json<PatchErrorResponse>({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const url = new URL(request.url);
    const snapshotId = url.searchParams.get("snapshotId");
    const patchId = url.searchParams.get("patchId");
    const includeBody = wantsBody(url.searchParams.get("includeBody"));
    const format = url.searchParams.get("format");
    const status = parsePatchStatus(url.searchParams.get("status"));
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

    if (!snapshotId && !patchId) {
      return NextResponse.json<PatchErrorResponse>({ error: "Missing snapshotId or patchId" }, { status: 400 });
    }
    if (url.searchParams.get("status") && !status) {
      return NextResponse.json<PatchErrorResponse>({ error: "Invalid status" }, { status: 400 });
    }

    if (patchId) {
      const patch = await getPatch({ userId: token.userId, patchId });
      if (!patch) {
        return NextResponse.json<PatchErrorResponse>({ error: "Patch not found" }, { status: 404 });
      }

      if (wantsRaw(format)) {
        return new NextResponse(patch.patchBody, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      return NextResponse.json<PatchResponse>({ patch: serializePatch(patch, true) });
    }

    const patches = await listPatches({
      userId: token.userId,
      snapshotId: snapshotId ?? "",
      status,
      limit,
      cursor,
    });

    const nextCursor: string | null = patches.length === limit ? patches[patches.length - 1].id : null;

    return NextResponse.json<PatchListResponse>({
      patches: patches.map((patch) => serializePatch(patch, includeBody)),
      nextCursor,
    });
  });
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;
    if (!(await rateLimit(`cli-patches:${ip}`))) {
      logAbuseSignal({ ip, reason: "cli-patches-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI patches unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:patch"]);
    if (response) return response;
    if (!(await rateLimit(`cli-patches:user:${token.userId}`))) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-patches-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_PATCH_BODY_BYTES * 1.5) { // Allow some overhead for JSON wrapping
      return NextResponse.json(
        { error: `Payload too large (max ${MAX_PATCH_BODY_BYTES} bytes)` },
        { status: 413 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    if (parsed.data.patchBody.length > MAX_PATCH_BODY_BYTES) {
      return NextResponse.json(
        { error: `Patch body exceeds size limit (max ${MAX_PATCH_BODY_BYTES} bytes)` },
        { status: 413 }
      );
    }

    try {
      const patch = await createPatch({ userId: token.userId, input: parsed.data });

      auditLog("cli_patch_create", {
        ip,
        traceId,
        userId: token.userId,
        snapshotId: patch.snapshotId,
        patchId: patch.id,
        path: patch.path,
        status: patch.status,
      });
      logAuditEvent({
        event: "cli_patch_create",
        ip,
        traceId,
        userId: token.userId,
        snapshotId: patch.snapshotId,
        metadata: {
          patchId: patch.id,
          path: patch.path,
          status: patch.status,
        },
      });

      return NextResponse.json({ patch: serializePatch(patch, true) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Patch create failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
