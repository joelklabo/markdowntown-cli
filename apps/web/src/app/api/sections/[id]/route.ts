import { NextResponse } from "next/server";
import { requireSession } from "@/lib/requireSession";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimiter";
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "@/lib/validation";
import { getSectionsCached } from "@/lib/cache";
import { normalizeTags } from "@/lib/tags";
import { safeRevalidateTag } from "@/lib/revalidate";
import { cacheTags } from "@/lib/cacheTags";

type RouteContext = { params: Promise<{ id: string }> };

async function authorizeSection(context: RouteContext, userId: string) {
  const { id } = await context.params;
  return prisma.snippet.findFirst({
    where: { id, userId },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const section = await authorizeSection(context, session.user.id);
  if (!section) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(section);
}

export async function PUT(request: Request, context: RouteContext) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`put:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const updateData: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) {
    updateData.title = body.title.trim();
    if ((updateData.title as string).length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title is too long (max ${MAX_TITLE_LENGTH} characters)` },
        { status: 400 }
      );
    }
  }
  if (typeof body.content === "string") {
    updateData.content = body.content;
    const content = updateData.content as string;
    const lower = content.toLowerCase();
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content is too long (max ${MAX_CONTENT_LENGTH} characters)` },
        { status: 400 }
      );
    }
    if (lower.includes("<script") || lower.includes("<iframe") || lower.includes("javascript:")) {
      return NextResponse.json({ error: "Content contains disallowed markup" }, { status: 400 });
    }
  }
  if (typeof body.order === "number") {
    updateData.order = body.order;
  }
  if (Object.prototype.hasOwnProperty.call(body, "tags")) {
    const { tags, error: tagError } = normalizeTags(body.tags);
    if (tagError) {
      return NextResponse.json({ error: tagError }, { status: 400 });
    }
    updateData.tags = tags;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No updates supplied" }, { status: 400 });
  }

  const section = await authorizeSection(context, session.user.id);
  if (!section) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await context.params;
  const updated = await prisma.snippet.update({
    where: { id },
    data: updateData,
  });

  // warm cache
  void getSectionsCached(session.user.id);
  safeRevalidateTag(cacheTags.list("all"));
  safeRevalidateTag(cacheTags.list("snippet"));
  safeRevalidateTag(cacheTags.tags);
  safeRevalidateTag(cacheTags.detail("snippet", updated.slug ?? updated.id));
  safeRevalidateTag(cacheTags.landing);

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const ip = (await _request)?.headers?.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`del:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const section = await authorizeSection(context, session.user.id);
  if (!section) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await context.params;
  await prisma.snippet.delete({ where: { id } });
  void getSectionsCached(session.user.id);
  safeRevalidateTag(cacheTags.list("all"));
  safeRevalidateTag(cacheTags.list("snippet"));
  safeRevalidateTag(cacheTags.tags);
  safeRevalidateTag(cacheTags.detail("snippet", section.slug ?? section.id));
  safeRevalidateTag(cacheTags.landing);
  return NextResponse.json({ ok: true });
}
