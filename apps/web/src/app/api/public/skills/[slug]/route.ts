import { NextResponse } from "next/server";
import { getPublicSkill } from "@/lib/publicSkills";
import { SkillValidationError } from "@/lib/skills/skillValidate";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";

type RouteContext = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  return withAPM(request, async () => {
    const start = performance.now();
    const { slug } = await context.params;
    let skill = null;
    try {
      skill = await getPublicSkill(slug);
    } catch (err) {
      if (err instanceof SkillValidationError) {
        return NextResponse.json(
          { error: "Invalid skill payload", slug: err.slugOrId, issues: err.issues },
          { status: 422 }
        );
      }
      console.error("public skill detail failed", err);
      return NextResponse.json({ error: "Failed to load skill" }, { status: 500 });
    }

    if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const cookie = request.headers.get("cookie");
    const cacheIntent = hasSessionCookie(cookie) ? "bypass" : "cacheable";
    const headers = new Headers(cacheHeaders("detail", cookie));
    headers.set(
      "Server-Timing",
      [`app;dur=${(performance.now() - start).toFixed(1)}`, `cache;desc=${cacheIntent}`].join(", ")
    );
    headers.set("x-cache-profile", "detail");
    headers.set("x-cache-intent", cacheIntent);

    return NextResponse.json(skill, { headers });
  });
}
