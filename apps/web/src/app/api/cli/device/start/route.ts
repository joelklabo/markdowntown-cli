import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, withAPM } from "@/lib/observability";
import { prisma, hasDatabaseEnv } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal } from "@/lib/reports";
import { createDeviceCodePayload } from "@/lib/cli/deviceFlow";
import { normalizeScopes } from "@/lib/cli/tokens";
import { MAX_CLI_TOKEN_LABEL_LENGTH } from "@/lib/validation";

export const dynamic = "force-dynamic";

const StartSchema = z.object({
  clientId: z.string().min(1).max(120).optional(),
  cliVersion: z.string().min(1).max(40).optional(),
  deviceName: z.string().min(1).max(MAX_CLI_TOKEN_LABEL_LENGTH).optional(),
  scopes: z.array(z.string().min(1).max(40)).optional(),
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
    if (!(await rateLimit(`cli-device-start:${ip}`))) {
      logAbuseSignal({ ip, reason: "cli-device-start-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI auth unavailable" }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const parsed = StartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const { scopes, clientId, deviceName, cliVersion } = parsed.data;
    const normalizedScopes = normalizeScopes(scopes);
    if (normalizedScopes.error) {
      return NextResponse.json({ error: normalizedScopes.error }, { status: 400 });
    }

    const payload = createDeviceCodePayload();

    await prisma.cliDeviceCode.create({
      data: {
        deviceCodeHash: payload.deviceCodeHash,
        userCodeHash: payload.userCodeHash,
        expiresAt: payload.expiresAt,
        intervalSeconds: payload.intervalSeconds,
        scopes: normalizedScopes.scopes,
        clientId: clientId?.trim() || null,
        deviceName: deviceName?.trim() || null,
      },
    });

    auditLog("cli_device_start", {
      ip,
      traceId,
      clientId: clientId ?? null,
      cliVersion: cliVersion ?? null,
      deviceName: deviceName ?? null,
      scopes: normalizedScopes.scopes,
      deviceCodeHash: payload.deviceCodeHash,
    });

    const origin = getOrigin(request);
    const verificationUri = `${origin}/device`;
    const verificationUriComplete = `${verificationUri}?code=${encodeURIComponent(payload.userCode)}`;
    const expiresIn = Math.floor((payload.expiresAt.getTime() - Date.now()) / 1000);

    return NextResponse.json({
      device_code: payload.deviceCode,
      user_code: payload.userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      interval: payload.intervalSeconds,
      expires_in: expiresIn,
      scopes: normalizedScopes.scopes,
    });
  });
}
