import { NextResponse } from "next/server";
import { getPublicTemplate } from "@/lib/publicTemplates";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";

type RouteContext = { params: Promise<{ id: string }> };

function renderBody(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => values[key] ?? "");
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const start = performance.now();
    const { id } = await context.params;
    const template = await getPublicTemplate(id);
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const values = (body?.values ?? {}) as Record<string, string>;
    const rendered = renderBody(template.body, values);

    const cookie = request.headers.get("cookie");
    const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
    const headers = new Headers(cacheHeaders("detail", cookie));
    headers.set(
      "Server-Timing",
      [`app;dur=${(performance.now() - start).toFixed(1)}`, `cache;desc=${cacheIntent}`].join(", ")
    );
    headers.set("x-cache-profile", "detail");
    headers.set("x-cache-intent", cacheIntent);

    return NextResponse.json({ rendered }, { headers });
  });
}
