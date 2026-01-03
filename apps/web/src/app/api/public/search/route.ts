import { NextResponse } from "next/server";
import { listPublicItems, type PublicItemType } from "@/lib/publicItems";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";
import { rateLimit } from "@/lib/rateLimiter";

function parseType(input: string | null): PublicItemType | "all" {
  if (input === "snippet" || input === "template" || input === "file" || input === "agent" || input === "skill") return input;
  return "all";
}

function parseSort(input: string | null): "recent" | "views" | "copies" {
  if (input === "views" || input === "copies") return input;
  if (input === "trending" || input === "top") return "views";
  if (input === "copied") return "copies";
  return "recent";
}

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`public-search:${ip}`)) {
      return NextResponse.json({ items: [], error: "Rate limit exceeded" }, { status: 429 });
    }
    const start = performance.now();
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const tags = url.searchParams.getAll("tag");
    const type = parseType(url.searchParams.get("type"));
    const sort = parseSort(url.searchParams.get("sort"));
    const limit = Number(url.searchParams.get("limit") ?? 30);

    try {
      const items = await listPublicItems({
        limit: Math.min(Math.max(limit, 1), 90),
        tags,
        type,
        sort,
        search: q,
      });

      const cookie = request.headers.get("cookie");
      const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
      const headers = new Headers(cacheHeaders("browse", cookie));
      headers.set(
        "Server-Timing",
        [`app;dur=${(performance.now() - start).toFixed(1)}`, `cache;desc=${cacheIntent}`].join(", ")
      );
      headers.set("x-cache-profile", "browse");
      headers.set("x-cache-intent", cacheIntent);

      return NextResponse.json({ items }, { headers });
    } catch (err) {
      console.error("public search failed", err);
      return NextResponse.json({ items: [] }, { status: 500 });
    }
  });
}
