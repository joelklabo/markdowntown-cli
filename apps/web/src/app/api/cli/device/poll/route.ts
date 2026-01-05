import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, withAPM } from "@/lib/observability";
import { prisma, hasDatabaseEnv } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal } from "@/lib/reports";
import { hashCode } from "@/lib/cli/deviceFlow";
import { issueCliToken } from "@/lib/cli/tokens";

export const dynamic = "force-dynamic";

const PollSchema = z.object({
  device_code: z.string().min(1).max(256),
});

const MAX_POLL_INTERVAL_SECONDS = 30;

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;
    if (!(await rateLimit(`cli-device-poll:${ip}`))) {
      logAbuseSignal({ ip, reason: "cli-device-poll-rate-limit", traceId });
      auditLog("cli_device_poll_rate_limit", { ip, traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI auth unavailable" }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const parsed = PollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const deviceCodeHash = hashCode(parsed.data.device_code);
    const record = await prisma.cliDeviceCode.findUnique({ where: { deviceCodeHash } });

    if (!record) {
      logAbuseSignal({ ip, reason: "cli-device-poll-invalid-code", traceId });
      return NextResponse.json({ error: "invalid_device_code" }, { status: 404 });
    }

    const now = new Date();
    if (record.expiresAt <= now) {
      if (record.status !== "EXPIRED") {
        await prisma.cliDeviceCode.update({
          where: { id: record.id },
          data: { status: "EXPIRED" },
        });
      }
      auditLog("cli_device_poll_expired", { ip, traceId, deviceCodeId: record.id });
      return NextResponse.json({ error: "expired_token" }, { status: 410 });
    }

    if (record.status === "DENIED") {
      return NextResponse.json({ error: "access_denied" }, { status: 403 });
    }

    if (record.status === "APPROVED") {
      const userId = record.userId;
      if (!userId) {
        return NextResponse.json({ error: "invalid_device_code" }, { status: 400 });
      }

      const token = await prisma.$transaction(async (tx) => {
        const consumed = await tx.cliDeviceCode.updateMany({
          where: { id: record.id, status: "APPROVED" },
          data: { status: "EXPIRED" },
        });
        if (consumed.count === 0) return null;
        return issueCliToken({
          userId,
          scopes: record.scopes,
          label: record.deviceName ?? record.clientId ?? undefined,
          client: tx as typeof prisma,
        });
      });

      if (!token) {
        return NextResponse.json({ error: "authorization_pending" }, { status: 400 });
      }

      auditLog("cli_device_poll_issue", {
        ip,
        traceId,
        deviceCodeId: record.id,
        userId,
        tokenId: token.tokenId,
        scopes: token.scopes,
      });

      const expiresIn = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
      return NextResponse.json({
        access_token: token.token,
        token_type: "Bearer",
        expires_in: expiresIn,
        scopes: token.scopes,
      });
    }

    const elapsedMs = Date.now() - record.updatedAt.getTime();
    const requiredMs = record.intervalSeconds * 1000;
    if (elapsedMs < requiredMs) {
      const nextInterval = Math.min(record.intervalSeconds + 5, MAX_POLL_INTERVAL_SECONDS);
      if (nextInterval !== record.intervalSeconds) {
        await prisma.cliDeviceCode.update({
          where: { id: record.id },
          data: { intervalSeconds: nextInterval },
        });
      }
      auditLog("cli_device_poll_slow_down", {
        ip,
        traceId,
        deviceCodeId: record.id,
        interval: nextInterval,
      });
      return NextResponse.json({ error: "slow_down", interval: nextInterval }, { status: 429 });
    }

    await prisma.cliDeviceCode.update({
      where: { id: record.id },
      data: { intervalSeconds: record.intervalSeconds },
    });

    return NextResponse.json({ error: "authorization_pending" }, { status: 400 });
  });
}
