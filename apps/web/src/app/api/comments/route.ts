import { NextResponse } from "next/server";

// Comments were part of an earlier schema that has since been removed.
// Keep the route to avoid breaking clients, but return a clear 501.
export async function POST() {
  return NextResponse.json(
    { error: "Comments are not supported on this deployment." },
    { status: 501 }
  );
}
