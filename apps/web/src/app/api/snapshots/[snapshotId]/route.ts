import { NextResponse } from "next/server";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { CLI_SNAPSHOT_LIMITS, rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal } from "@/lib/reports";
import { requireCliToken } from "@/lib/requireCliToken";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ snapshotId: string }> };

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;

    if (!rateLimit(`cli-snapshots:detail:${ip}`, CLI_SNAPSHOT_LIMITS.list)) {
      logAbuseSignal({ ip, reason: "cli-snapshots-detail-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "Snapshots unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request);
    if (response) return response;
    if (!rateLimit(`cli-snapshots:detail:user:${token.userId}`, CLI_SNAPSHOT_LIMITS.list)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-snapshots-detail-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { snapshotId } = await context.params;
    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, project: { userId: token.userId } },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            provider: true,
          },
        },
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
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    auditLog("cli_snapshot_fetch", {
      ip,
      traceId,
      userId: token.userId,
      projectId: snapshot.projectId,
      snapshotId: snapshot.id,
    });

    return NextResponse.json({ snapshot });
  });
}
