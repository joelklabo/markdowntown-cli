import { NextResponse } from "next/server";
import { listPublicSkills } from "@/lib/publicSkills";
import { SkillValidationError } from "@/lib/skills/skillValidate";
import type { ListPublicSkillsInput } from "@/lib/skills/skillTypes";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";
import { withAPM } from "@/lib/observability";
import { rateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

function parseSort(input: string | null): NonNullable<ListPublicSkillsInput["sort"]> {
  if (input === "views" || input === "copies") return input;
  if (input === "trending" || input === "top") return "views";
  if (input === "copied") return "copies";
  return "recent";
}

export async function GET(request: Request) {
  return withAPM(request, async () => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`public-skills:${ip}`)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const start = performance.now();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const sort = parseSort(url.searchParams.get("sort"));
    const q = url.searchParams.get("q");
    const tagsParam = url.searchParams.getAll("tag");
    const tagsCsv = url.searchParams.get("tags");
    const tagsRaw = tagsCsv ? tagsCsv.split(",") : tagsParam;
    const targetsParam = url.searchParams.getAll("target");
    const targetsCsv = url.searchParams.get("targets");
    const targetsRaw = targetsCsv ? targetsCsv.split(",") : targetsParam;

    try {
      const skills = await listPublicSkills({
        limit: Number.isNaN(limit) ? 30 : Math.min(Math.max(limit, 1), 200),
        sort,
        search: q,
        tags: tagsRaw,
        targets: targetsRaw,
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

      return NextResponse.json(skills, { headers });
    } catch (err) {
      if (err instanceof SkillValidationError) {
        return NextResponse.json(
          { error: "Invalid skill payload", slug: err.slugOrId, issues: err.issues },
          { status: 422 }
        );
      }
      console.error("public skills failed", err);
      return NextResponse.json({ error: "Failed to load skills" }, { status: 500 });
    }
  });
}
