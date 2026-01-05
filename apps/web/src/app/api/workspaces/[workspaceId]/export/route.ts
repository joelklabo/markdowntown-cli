import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/requireSession";
import { prisma } from "@/lib/prisma";
import { generateWorkspaceZip } from "@/lib/export/zip";
import { createPatchFromEdit } from "@/lib/export/patch";

const exportSchema = z.object({
  format: z.enum(["zip", "patch"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { workspaceId } = await params;
  const json = await req.json();
  const body = exportSchema.safeParse(json);
  
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { edits: true, snapshot: { include: { project: true } } },
  });

  if (!workspace || workspace.snapshot.project.userId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (body.data.format === "zip") {
    const zipBuffer = await generateWorkspaceZip(workspace.edits);
    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="workspace-${workspaceId}.zip"`,
      },
    });
  } else {
    // Generate patches for all edited files
    const patches = await Promise.all(
      workspace.edits.map((edit) =>
        createPatchFromEdit(
          session.user.id,
          workspace.snapshotId,
          edit.path,
          edit.content
        )
      )
    );
    return NextResponse.json({ patches });
  }
}
