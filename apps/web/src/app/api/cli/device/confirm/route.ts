import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, withAPM } from "@/lib/observability";
import { prisma, hasDatabaseEnv } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal } from "@/lib/reports";
import { requireSession } from "@/lib/requireSession";
import { hashCode, normalizeUserCode, USER_CODE_LENGTH } from "@/lib/cli/deviceFlow";

export const dynamic = "force-dynamic";

const ConfirmSchema = z.object({
  user_code: z.string().min(1).max(32),
  approved: z.boolean().optional(),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (!session) return response;

  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;
    if (!rateLimit(`cli-device-confirm:${ip}:${session.user.id}`)) {
      logAbuseSignal({ ip, userId: session.user.id, reason: "cli-device-confirm-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI auth unavailable" }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const normalizedCode = normalizeUserCode(parsed.data.user_code);
    if (!normalizedCode || normalizedCode.length !== USER_CODE_LENGTH) {
      return NextResponse.json({ error: "Invalid user code" }, { status: 400 });
    }

    const userCodeHash = hashCode(normalizedCode);
    const record = await prisma.cliDeviceCode.findUnique({ where: { userCodeHash } });
    if (!record) {
      logAbuseSignal({ ip, userId: session.user.id, reason: "cli-device-confirm-invalid-code", traceId });
      return NextResponse.json({ error: "invalid_user_code" }, { status: 404 });
    }

    const now = new Date();
    if (record.expiresAt <= now || record.status === "EXPIRED") {
      if (record.status !== "EXPIRED") {
        await prisma.cliDeviceCode.update({ where: { id: record.id }, data: { status: "EXPIRED" } });
      }
      return NextResponse.json({ error: "expired_token" }, { status: 410 });
    }

    if (record.status === "APPROVED" || record.status === "DENIED") {
      if (record.userId && record.userId !== session.user.id) {
        return NextResponse.json({ error: "code_already_used" }, { status: 409 });
      }
      return NextResponse.json({ status: record.status.toLowerCase() });
    }

    const approved = parsed.data.approved ?? true;
    const status = approved ? "APPROVED" : "DENIED";

    await prisma.cliDeviceCode.update({
      where: { id: record.id },
      data: {
        status,
        userId: approved ? session.user.id : null,
        confirmedAt: new Date(),
      },
    });

    auditLog("cli_device_confirm", {
      ip,
      traceId,
      deviceCodeId: record.id,
      userId: session.user.id,
      approved,
      scopes: record.scopes,
      deviceName: record.deviceName,
      clientId: record.clientId,
    });

    return NextResponse.json({ status: approved ? "approved" : "denied" });
  });
}
