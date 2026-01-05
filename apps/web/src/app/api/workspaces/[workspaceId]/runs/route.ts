import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/requireSession";
import { runWorkspaceAuditWithWasm } from "@/lib/workspace/runs";

const runSchema = z.object({
  type: z.enum(["audit", "suggest"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { workspaceId } = await params;
  const json = await req.json();
  const body = runSchema.safeParse(json);
  
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.data.type !== "audit") {
    return NextResponse.json({ error: "Only audit is supported in workspace for now" }, { status: 400 });
  }

  try {
    const run = await runWorkspaceAuditWithWasm(session.user.id, workspaceId);
    return NextResponse.json({ run });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Run failed" }, { status: 500 });
  }
}
