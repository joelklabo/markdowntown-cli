import { NextResponse } from "next/server";

// Favorites were part of an earlier schema that has since been removed.
export async function POST() {
  return NextResponse.json(
    { error: "Favorites are not supported on this deployment." },
    { status: 501 }
  );
}
