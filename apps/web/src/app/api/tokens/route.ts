import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, withAPM } from "@/lib/observability";
import { prisma, hasDatabaseEnv } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal } from "@/lib/reports";
import { requireSession } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

const RevokeSchema = z.object({
  tokenId: z.string().min(1).max(120),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function PATCH(request: Request) {
  const { session, response } = await requireSession();
  if (!session) return response;

  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    if (!rateLimit(`cli-token-revoke:${ip}:${session.user.id}`)) {
      logAbuseSignal({ ip, userId: session.user.id, reason: "cli-token-revoke-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI auth unavailable" }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const parsed = RevokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const token = await prisma.cliToken.findFirst({
      where: { id: parsed.data.tokenId, userId: session.user.id },
    });

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    let revokedAt = token.revokedAt;
    if (!revokedAt) {
      const updated = await prisma.cliToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
      revokedAt = updated.revokedAt;
    }

    auditLog("cli_token_revoke", {
      ip,
      traceId,
      userId: session.user.id,
      tokenId: token.id,
    });

    return NextResponse.json({ ok: true, revokedAt });
  });
}
