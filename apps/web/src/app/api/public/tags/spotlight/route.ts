import { NextResponse } from "next/server";
import { listSpotlightTags } from "@/lib/publicTags";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const start = performance.now();
    const tags = await listSpotlightTags(20);
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
