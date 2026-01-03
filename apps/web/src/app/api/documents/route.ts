import { NextResponse } from "next/server";
import { Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { normalizeTags } from "@/lib/tags";
import { safeRevalidateTag } from "@/lib/revalidate";
import { cacheTags } from "@/lib/cacheTags";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const docs = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(
    docs.map((d) => ({
      ...d,
      tags: normalizeTags(d.tags, { strict: false }).tags,
    }))
  );
}

export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const body = await request.json().catch(() => ({}));
  const title = (body.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const description = (body.description ?? "").toString();
  const renderedContent = (body.renderedContent ?? "").toString();
  const tags = normalizeTags(body.tags ?? [], { strict: false }).tags;
  const snippetIds =
    Array.isArray(body.snippetIds) && body.snippetIds.length
      ? (body.snippetIds as unknown[]).map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
      : [];
  const overrides = (body.overrides ?? {}) as Record<string, string>;

  const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slug = `${slugBase || "doc"}-${Date.now().toString(36)}`;

  let accessibleSnippets: Array<{ id: string; visibility: Visibility; userId: string | null }> = [];

  if (snippetIds.length) {
    const visibilityFilter = session.user.id
      ? { OR: [{ visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } }, { userId: session.user.id }] }
      : { visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } };

    accessibleSnippets = await prisma.snippet.findMany({
      where: {
        id: { in: snippetIds },
        ...visibilityFilter,
      },
      select: { id: true, visibility: true, userId: true },
    });

    const missingSnippetIds = snippetIds.filter((id) => !accessibleSnippets.find((s) => s.id === id));
    if (missingSnippetIds.length === snippetIds.length) {
      return NextResponse.json(
        { error: "Snippets not found or not accessible", missingSnippetIds },
        { status: 404 }
      );
    }
    if (missingSnippetIds.length) {
      return NextResponse.json(
        { error: "Some snippets are not accessible", missingSnippetIds },
        { status: 403 }
      );
    }
  }

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        title,
        description,
        renderedContent,
        tags,
        visibility: "PRIVATE",
        userId: session.user.id,
        slug,
      },
    });

    if (snippetIds.length) {
      await tx.documentSnippet.createMany({
        data: snippetIds.map((id, idx) => ({
          documentId: created.id,
          snippetId: id,
          position: idx,
          overrides: typeof overrides[id] === "string" ? overrides[id] : undefined,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  safeRevalidateTag(cacheTags.list("all"));
  safeRevalidateTag(cacheTags.list("file"));
  safeRevalidateTag(cacheTags.tags);
  safeRevalidateTag(cacheTags.detail("file", doc.slug));
  safeRevalidateTag(cacheTags.landing);

  return NextResponse.json(
    {
      ...doc,
      snippetIds,
    },
    { status: 201 }
  );
}
