import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeSnapshotUpload, requireCliToken } from "@/lib/cli/upload";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv } from "@/lib/prisma";
import { CLI_UPLOAD_LIMITS, rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";

export const dynamic = "force-dynamic";

const CompleteSchema = z.object({
  snapshotId: z.string().min(1),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    if (!rateLimit(`cli-upload-complete:${ip}`, CLI_UPLOAD_LIMITS.complete)) {
      logAbuseSignal({ ip, reason: "cli-upload-complete-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI upload unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:upload"]);
    if (response) return response;
    if (!rateLimit(`cli-upload-complete:user:${token.userId}`, CLI_UPLOAD_LIMITS.complete)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-upload-complete-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = CompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    try {
      const result = await finalizeSnapshotUpload({
        userId: token.userId,
        snapshotId: parsed.data.snapshotId,
      });

      if (result.missingBlobs.length > 0) {
        return NextResponse.json(
          { error: "Missing blobs", missingBlobs: result.missingBlobs },
          { status: 409 }
        );
      }

      auditLog("cli_upload_complete", {
        ip,
        traceId,
        userId: token.userId,
        snapshotId: result.snapshot.id,
      });
      logAuditEvent({
        event: "cli_upload_complete",
        ip,
        traceId,
        userId: token.userId,
        snapshotId: result.snapshot.id,
      });

      return NextResponse.json({ status: "ready", snapshotId: result.snapshot.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Finalize failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
