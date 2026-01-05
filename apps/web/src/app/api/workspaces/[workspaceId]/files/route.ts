import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveFileEdit } from "@/lib/workspace";
import { requireSession } from "@/lib/requireSession";

const editSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) {
    return response;
  }

  const { workspaceId } = await params;
  const json = await req.json();
  const body = editSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const edit = await saveFileEdit(
      session.user.id,
      workspaceId,
      body.data.path,
      body.data.content
    );
    return NextResponse.json(edit);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Forbidden or Not Found" },
      { status: 403 }
    );
  }
}
