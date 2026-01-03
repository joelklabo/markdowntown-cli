import { NextResponse } from "next/server";
import { getPublicSection } from "@/lib/publicSections";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const start = performance.now();
    const { id } = await context.params;
    const section = await getPublicSection(id);
    if (!section) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const cookie = request.headers.get("cookie");
    const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
    const headers = new Headers(cacheHeaders("detail", cookie));
    headers.set(
      "Server-Timing",
      [`app;dur=${(performance.now() - start).toFixed(1)}`, `cache;desc=${cacheIntent}`].join(", ")
    );
    headers.set("x-cache-profile", "detail");
    headers.set("x-cache-intent", cacheIntent);
    return NextResponse.json(section, { headers });
  });
}
