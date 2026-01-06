import { NextResponse } from "next/server";
import { requireSession } from "@/lib/requireSession";
import { cleanupAuditIssues } from "@/lib/audit/store";
import { auditLog, withAPM } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Trigger manual cleanup of expired audit issues.
 * Gated by user session for now.
 */
export async function POST(request: Request) {
  return withAPM(request, async () => {
    const { session, response } = await requireSession();
    if (!session) return response;

    // TODO: add admin check here

    try {
      const { deleted } = await cleanupAuditIssues();
      
      auditLog("api_audit_cleanup_triggered", {
        userId: session.user.id,
        deletedCount: deleted,
      });

      return NextResponse.json({ 
        ok: true, 
        deleted,
        message: `Successfully removed ${deleted} expired audit issues.` 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audit cleanup failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
