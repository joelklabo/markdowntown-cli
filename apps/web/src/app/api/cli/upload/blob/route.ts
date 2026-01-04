import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCliToken } from "@/lib/cli/upload";
import { validateBlobUpload } from "@/lib/cli/validation";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { CLI_UPLOAD_LIMITS, rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";

export const dynamic = "force-dynamic";

const BlobSchema = z.object({
  snapshotId: z.string().min(1),
  sha256: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  contentBase64: z.string().optional(),
  storageKey: z.string().optional(),
  contentType: z.string().max(200).optional(),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    if (!rateLimit(`cli-upload-blob:${ip}`, CLI_UPLOAD_LIMITS.blob)) {
      logAbuseSignal({ ip, reason: "cli-upload-blob-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI upload unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:upload"]);
    if (response) return response;
    if (!rateLimit(`cli-upload-blob:user:${token.userId}`, CLI_UPLOAD_LIMITS.blob)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-upload-blob-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = BlobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const { snapshotId, sha256, sizeBytes, contentBase64, storageKey, contentType } = parsed.data;
    if (!contentBase64 && !storageKey) {
      return NextResponse.json({ error: "Missing blob content" }, { status: 400 });
    }
    const validationError = validateBlobUpload({ sha256, sizeBytes, contentType });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, project: { userId: token.userId } },
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    let content: Buffer | null = null;
    if (contentBase64) {
      content = Buffer.from(contentBase64, "base64");
      if (content.length !== sizeBytes) {
        return NextResponse.json({ error: "Blob size mismatch" }, { status: 400 });
      }
      const computedHash = createHash("sha256").update(content).digest("hex");
      if (computedHash !== sha256) {
        return NextResponse.json({ error: "Blob hash mismatch" }, { status: 400 });
      }
    }

    const existing = await prisma.blob.findUnique({ where: { sha256 } });
    if (existing && existing.sizeBytes !== sizeBytes) {
      return NextResponse.json({ error: "Blob size mismatch" }, { status: 400 });
    }

    const updated = await prisma.blob.upsert({
      where: { sha256 },
      create: {
        sha256,
        sizeBytes,
        content,
        storageKey: storageKey ?? null,
      },
      update: {
        sizeBytes,
        content: existing?.content ?? content,
        storageKey: existing?.storageKey ?? storageKey ?? null,
      },
    });

    auditLog("cli_upload_blob", {
      ip,
      traceId,
      userId: token.userId,
      snapshotId,
      sha256,
      sizeBytes,
      contentType: contentType ?? null,
    });
    logAuditEvent({
      event: "cli_upload_blob",
      ip,
      traceId,
      userId: token.userId,
      snapshotId,
      metadata: { sha256, sizeBytes, contentType: contentType ?? null },
    });

    return NextResponse.json({ status: "ok", blobId: updated.id });
  });
}
