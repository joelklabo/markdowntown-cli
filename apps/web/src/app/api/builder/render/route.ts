import { NextResponse } from "next/server";
import { Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RenderRequest = {
  templateId?: string | null;
  snippetIds?: string[];
  overrides?: Record<string, string>;
};

function sanitizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RenderRequest;
  const snippetIds = sanitizeIds(body.snippetIds);
  const templateId = typeof body.templateId === "string" ? body.templateId.trim() : null;
  const overrides = (body.overrides ?? {}) as Record<string, string>;

  if (!snippetIds.length && !templateId) {
    return NextResponse.json({ error: "Provide at least one snippet or a template" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const snippetVisibility = userId
    ? { OR: [{ visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } }, { userId }] }
    : { visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } };

  const snippets = snippetIds.length
    ? await prisma.snippet.findMany({
        where: {
          id: { in: snippetIds },
          ...snippetVisibility,
        },
        select: { id: true, title: true, content: true, visibility: true, userId: true },
      })
    : [];

  const template = templateId
    ? await prisma.template.findFirst({
        where: {
          id: templateId,
          ...(userId
            ? { OR: [{ visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } }, { userId }] }
            : { visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } }),
        },
        select: { id: true, title: true, description: true, body: true, visibility: true, userId: true },
      })
    : null;

  const orderedSnippets = snippetIds
    .map((id) => snippets.find((s) => s.id === id))
    .filter(Boolean) as typeof snippets;

  const parts: string[] = [];
  if (template) {
    parts.push(`# ${template.title}\n\n${template.body || template.description || ""}`.trim());
  }

  orderedSnippets.forEach((snip) => {
    const override = typeof overrides[snip.id] === "string" ? overrides[snip.id] : null;
    parts.push(`## ${snip.title}\n\n${override ?? snip.content}`.trim());
  });

  const rendered = parts.join("\n\n");

  const isRestricted = (item: { visibility: Visibility }) =>
    item.visibility === Visibility.PRIVATE || item.visibility === Visibility.UNLISTED;

  const hasPrivateContent = Boolean(
    (template && isRestricted(template)) || orderedSnippets.some((s) => isRestricted(s))
  );

  const missingSnippetIds = snippetIds.filter((id) => !snippets.find((s) => s.id === id));
  const status = missingSnippetIds.length && !orderedSnippets.length ? 404 : 200;

  return NextResponse.json(
    {
      rendered,
      hasPrivateContent,
      missingSnippetIds,
      included: {
        template: template ? { id: template.id, visibility: template.visibility, title: template.title } : null,
        snippets: orderedSnippets.map((s) => ({
          id: s.id,
          visibility: s.visibility,
          title: s.title,
        })),
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    }
  );
}
