import { NextResponse } from "next/server";
import { withAPM } from "@/lib/observability";
import { rateLimit } from "@/lib/rateLimiter";
import { searchAtlas } from "@/lib/atlas/searchIndex";

export const dynamic = "force-dynamic";

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    if (!rateLimit(`atlas-search:${ip}`)) {
      return NextResponse.json({ items: [], error: "Rate limit exceeded" }, { status: 429 });
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limit = clampLimit(Number(url.searchParams.get("limit") ?? 10));

    if (!q) {
      return NextResponse.json({ items: [], error: "Missing query" }, { status: 400 });
    }

    const hits = searchAtlas(q, { limit });
    return NextResponse.json({
      items: hits.map((hit) => ({ type: hit.kind, title: hit.title, href: hit.href })),
    });
  });
}

