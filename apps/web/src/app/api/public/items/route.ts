import { NextResponse } from "next/server";
import { listPublicItems, type ListPublicItemsInput } from "@/lib/publicItems";
import { normalizeTags } from "@/lib/tags";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";
import { rateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

function parseSort(input: string | null): NonNullable<ListPublicItemsInput["sort"]> {
  if (input === "views" || input === "copies") return input;
  if (input === "trending" || input === "top") return "views";
  if (input === "copied") return "copies";
  return "recent";
}

function parseType(input: string | null): NonNullable<ListPublicItemsInput["type"]> {
  if (input === "snippet" || input === "template" || input === "file" || input === "agent") return input;
  return "all";
}

function parseHasScopes(input: string | null): boolean | undefined {
  if (input === null) return undefined;
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return undefined;
}

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`public-items:${ip}`)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    const start = performance.now();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const sort = parseSort(url.searchParams.get("sort"));
    const type = parseType(url.searchParams.get("type"));
    const q = url.searchParams.get("q");
    const tagsParam = url.searchParams.getAll("tag");
    const tagsCsv = url.searchParams.get("tags");
    const tagsRaw = tagsCsv ? tagsCsv.split(",") : tagsParam;
    const tags = normalizeTags(tagsRaw, { strict: false }).tags;
    const targetsParam = url.searchParams.getAll("target");
    const targetsCsv = url.searchParams.get("targets");
    const targetsRaw = targetsCsv ? targetsCsv.split(",") : targetsParam;
    const hasScopes = parseHasScopes(url.searchParams.get("hasScopes"));

    const items = await listPublicItems({
      limit: Number.isNaN(limit) ? 30 : Math.min(Math.max(limit, 1), 200),
      sort,
      type,
      search: q,
      tags,
      targets: targetsRaw,
      hasScopes,
    });

    const cookie = request.headers.get("cookie");
    const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
    const headers = new Headers(cacheHeaders("browse", cookie));
    const serverTiming = [
      `app;dur=${(performance.now() - start).toFixed(1)}`,
      `cache;desc=${cacheIntent}`,
    ].join(", ");
    headers.set("Server-Timing", serverTiming);
    headers.set("x-cache-profile", "browse");
    headers.set("x-cache-intent", cacheIntent);

    return NextResponse.json(items, { headers });
  });
}
