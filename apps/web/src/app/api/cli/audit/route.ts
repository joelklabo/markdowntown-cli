import { NextResponse } from "next/server";
import { z } from "zod";
import { AuditSeverity } from "@prisma/client";
import { auditLog, withAPM } from "@/lib/observability";
import { hasDatabaseEnv } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";
import { requireCliToken } from "@/lib/cli/upload";
import { listAuditIssues, storeAuditIssues } from "@/lib/audit/store";
import { MAX_AUDIT_ISSUES, MAX_AUDIT_MESSAGE_LENGTH, MAX_AUDIT_RULE_ID_LENGTH } from "@/lib/validation";

export const dynamic = "force-dynamic";

const IssueSchema = z.object({
  ruleId: z.string().min(1).max(MAX_AUDIT_RULE_ID_LENGTH),
  severity: z.enum(["INFO", "WARNING", "ERROR"]),
  path: z.string().min(1).max(4096),
  message: z.string().min(1).max(MAX_AUDIT_MESSAGE_LENGTH),
});

const AuditSchema = z.object({
  snapshotId: z.string().min(1),
  issues: z.array(IssueSchema).max(MAX_AUDIT_ISSUES).default([]),
});

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function parseSeverity(value: string | null): AuditSeverity | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper in AuditSeverity) {
    return AuditSeverity[upper as keyof typeof AuditSeverity];
  }
  return undefined;
}

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;
    if (!rateLimit(`cli-audit:${ip}`)) {
      logAbuseSignal({ ip, reason: "cli-audit-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI audit unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:run"]);
    if (response) return response;
    if (!rateLimit(`cli-audit:user:${token.userId}`)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-audit-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const url = new URL(request.url);
    const snapshotId = url.searchParams.get("snapshotId");
    if (!snapshotId) {
      return NextResponse.json({ error: "Missing snapshotId" }, { status: 400 });
    }

    const severity = parseSeverity(url.searchParams.get("severity"));
    if (url.searchParams.get("severity") && !severity) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
    }

    const limit = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");

    const { issues, nextCursor } = await listAuditIssues({
      userId: token.userId,
      snapshotId,
      severity,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor ?? undefined,
    });

    return NextResponse.json({ issues, nextCursor });
  });
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    const traceId = request.headers.get("x-trace-id") ?? undefined;
    if (!rateLimit(`cli-audit:${ip}`)) {
      logAbuseSignal({ ip, reason: "cli-audit-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    if (!hasDatabaseEnv) {
      return NextResponse.json({ error: "CLI audit unavailable" }, { status: 503 });
    }

    const { token, response } = await requireCliToken(request, ["cli:run"]);
    if (response) return response;
    if (!rateLimit(`cli-audit:user:${token.userId}`)) {
      logAbuseSignal({ ip, userId: token.userId, reason: "cli-audit-user-rate-limit", traceId });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = AuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    try {
      const { snapshotId, issues } = parsed.data;
      const result = await storeAuditIssues({
        userId: token.userId,
        snapshotId,
        issues,
      });

      auditLog("cli_audit_store", {
        ip,
        traceId,
        userId: token.userId,
        snapshotId,
        issueCount: result.stored,
      });
      logAuditEvent({
        event: "cli_audit_store",
        ip,
        traceId,
        userId: token.userId,
        snapshotId,
        metadata: { issueCount: result.stored },
      });

      return NextResponse.json({ status: "ok", stored: result.stored });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audit store failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
