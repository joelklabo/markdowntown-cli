import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/requireSession";
import { revokeCliToken } from "@/lib/auth/cliToken";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { tokenId } = await params;

  try {
    await revokeCliToken(session.user.id, tokenId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
  }
}
