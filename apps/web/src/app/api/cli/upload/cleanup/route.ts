import { NextResponse } from "next/server";
import { requireSession } from "@/lib/requireSession";
import { cleanupStaleUploads } from "@/lib/cli/cleanup";
import { rateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Rate limit cleanup attempts
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`cleanup:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Ideally gate this behind an admin role or an internal secret header.
  // For now, require a valid user session.
  const { session, response } = await requireSession();
  if (!session) return response;

  const url = new URL(request.url);
  const maxAgeHours = parseInt(url.searchParams.get("maxAgeHours") || "24", 10);

  try {
    const result = await cleanupStaleUploads({ maxAgeHours });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
