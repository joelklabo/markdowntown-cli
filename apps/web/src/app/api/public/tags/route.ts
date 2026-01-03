import { NextResponse } from "next/server";
import { listTopTags } from "@/lib/publicTags";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";
import { rateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`public-tags:${ip}`)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    const start = performance.now();
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const windowParam = searchParams.get("window");

    const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100);
    const windowDays =
      windowParam === null
        ? null
        : windowParam === "all"
          ? null
          : Number(windowParam.replace("d", "")) || null;

    const tags = await listTopTags(limit, windowDays);

    const cookie = request.headers.get("cookie");
    const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
    const headers = new Headers(cacheHeaders("browse", cookie));
    headers.set(
      "Server-Timing",
      [`app;dur=${(performance.now() - start).toFixed(1)}`, `cache;desc=${cacheIntent}`].join(", ")
    );
    headers.set("x-cache-profile", "browse");
    headers.set("x-cache-intent", cacheIntent);

    return NextResponse.json(tags, { headers });
  });
}
