import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { normalizeTags } from "@/lib/tags";
import { safeRevalidateTag } from "@/lib/revalidate";
import { cacheTags } from "@/lib/cacheTags";

type RouteContext = { params: Promise<{ id: string }> };

async function requireOwner(id: string, userId: string) {
  const doc = await prisma.document.findFirst({ where: { id, userId } });
  return doc ?? null;
}

export async function GET(_req: Request, context: RouteContext) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await context.params;
  const doc = await requireOwner(id, session.user.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...doc, tags: normalizeTags(doc.tags, { strict: false }).tags });
}

export async function PUT(req: Request, context: RouteContext) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await context.params;
  const existing = await requireOwner(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? existing.title).toString().trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const description = (body.description ?? existing.description)?.toString() ?? "";
  const renderedContent = (body.renderedContent ?? existing.renderedContent)?.toString() ?? "";
  const tags = normalizeTags(body.tags ?? existing.tags, { strict: false }).tags;

  const updated = await prisma.document.update({
    where: { id },
    data: { title, description, renderedContent, tags },
  });

  safeRevalidateTag(cacheTags.list("all"));
  safeRevalidateTag(cacheTags.list("file"));
  safeRevalidateTag(cacheTags.tags);
  safeRevalidateTag(cacheTags.detail("file", updated.slug));
  safeRevalidateTag(cacheTags.landing);

  return NextResponse.json({ ...updated, tags });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await context.params;
  const existing = await requireOwner(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.document.delete({ where: { id } });
  safeRevalidateTag(cacheTags.list("all"));
  safeRevalidateTag(cacheTags.list("file"));
  safeRevalidateTag(cacheTags.tags);
  safeRevalidateTag(cacheTags.detail("file", existing.slug));
  safeRevalidateTag(cacheTags.landing);
  return NextResponse.json({ ok: true });
}
