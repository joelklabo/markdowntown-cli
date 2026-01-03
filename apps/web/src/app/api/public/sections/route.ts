import { NextResponse } from "next/server";
import { listPublicSections } from "@/lib/publicSections";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";
import { rateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`public-sections:${ip}`)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    const start = performance.now();
    const sections = await listPublicSections(50);
    const cookie = request.headers.get("cookie");
    const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
    const headers = new Headers(cacheHeaders("browse", cookie));
    const timing = [`app;dur=${(performance.now() - start).toFixed(1)}`, `cache;desc=${cacheIntent}`].join(", ");
    headers.set("Server-Timing", timing);
    headers.set("x-cache-profile", "browse");
    headers.set("x-cache-intent", cacheIntent);
    return NextResponse.json(sections, { headers });
  });
}
