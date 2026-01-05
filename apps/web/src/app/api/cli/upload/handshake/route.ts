import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv } from "@/lib/prisma";
import { CLI_UPLOAD_LIMITS, checkRateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";
import { createUploadHandshake, requireCliToken } from "@/lib/cli/upload";

export const dynamic = "force-dynamic";

const ManifestEntrySchema = z.object({
  path: z.string().min(1).max(4096),
  blobHash: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  mode: z.number().int().optional(),
  mtime: z.union([z.string(), z.number()]).optional(),
  isDeleted: z.boolean().optional(),
  contentType: z.string().max(200).optional(),
  isBinary: z.boolean().optional(),
});

const HandshakeSchema = z.object({
  projectId: z.string().optional(),
  projectSlug: z.string().optional(),
  projectName: z.string().optional(),
  provider: z.string().optional(),
  repoRoot: z.string().optional(),
  protocolVersion: z.string().optional(),
  idempotencyKey: z.string().optional(),
  baseSnapshotId: z.string().optional(),
  manifestHash: z.string().optional(),
  metadata: z.unknown().optional(),
  manifest: z.array(ManifestEntrySchema).min(1),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  if (!host) return url.origin;
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    const limitResponse = checkRateLimit(`cli-upload-handshake:${ip}`, CLI_UPLOAD_LIMITS.handshake);
    if (limitResponse) {
      logAbuseSignal({ ip, reason: "cli-upload-handshake-rate-limit", traceId });
      return limitResponse;
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI upload unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:upload"]);
    if (response) return response;

    const userLimitResponse = checkRateLimit(`cli-upload-handshake:user:${token.userId}`, CLI_UPLOAD_LIMITS.handshake);
    if (userLimitResponse) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-upload-handshake-user-rate-limit", traceId });
      return userLimitResponse;
    }

    const body = await request.json().catch(() => null);
    const parsed = HandshakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    try {
      const origin = getOrigin(request);
      const result = await createUploadHandshake({
        userId: token.userId,
        input: parsed.data,
        origin,
      });

      auditLog("cli_upload_handshake", {
        ip,
        traceId,
        userId: token.userId,
        snapshotId: result.snapshotId,
        missingCount: result.missingBlobs.length,
      });
      logAuditEvent({
        event: "cli_upload_handshake",
        ip,
        traceId,
        userId: token.userId,
        snapshotId: result.snapshotId,
        metadata: { missingCount: result.missingBlobs.length },
      });

      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload handshake failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
