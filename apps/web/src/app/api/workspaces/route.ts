import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createWorkspace } from "@/lib/workspace";
import { requireSession } from "@/lib/requireSession";

const createSchema = z.object({
  snapshotId: z.string(),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) {
    return response;
  }

  const json = await req.json();
  const body = createSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const workspace = await createWorkspace(session.user.id, body.data.snapshotId);
    return NextResponse.json(workspace);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Forbidden or Not Found" }, { status: 403 });
  }
}
