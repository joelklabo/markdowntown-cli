import { describe, it, expect, beforeEach, vi } from "vitest";

type Snippet = { id: string; title: string; content: string; visibility: string; userId: string | null };
type Document = {
  id: string;
  title: string;
  description: string | null;
  renderedContent: string | null;
  tags: string[];
  userId: string;
  slug: string;
};
type DocumentSnippet = { documentId: string; snippetId: string; position: number; overrides: string | null };

const snippets: Snippet[] = [
  { id: "s1", title: "Public", content: "A", visibility: "PUBLIC", userId: null },
  { id: "s2", title: "PrivateMine", content: "B", visibility: "PRIVATE", userId: "user-1" },
];
const documents: Document[] = [];
const docSnippets: DocumentSnippet[] = [];

const prismaMock = {
  snippet: {
    findMany: vi.fn(async ({ where }: { where: WhereInput }) => {
      const ids: string[] = where.id?.in ?? [];
      return snippets.filter((s) => ids.includes(s.id) && matchesVisibility(where, s));
    }),
  },
  document: {
    create: vi.fn(async ({ data }: { data: Document }) => {
      const created: Document = {
        id: `doc-${documents.length + 1}`,
        title: data.title,
        description: data.description,
        renderedContent: data.renderedContent,
        tags: data.tags ?? [],
        userId: data.userId,
        slug: data.slug,
      };
      documents.push(created);
      return created;
    }),
  },
  documentSnippet: {
    createMany: vi.fn(async ({ data }: { data: DocumentSnippet[] }) => {
      docSnippets.push(...data);
      return { count: data.length };
    }),
  },
  $transaction: vi.fn(async <T>(cb: (tx: typeof prismaMock) => Promise<T>) => cb(prismaMock) as Promise<T>),
};

type WhereInput = {
  id?: { in?: string[] };
  OR?: WhereInput[];
  visibility?: { in?: string[] };
  userId?: string;
};

function matchesVisibility(where: WhereInput, row: Snippet): boolean {
  if (where.OR) {
    return where.OR.some((cond) => matchesVisibility(cond, row));
  }
  if (where.visibility?.in) {
    return where.visibility.in.includes(row.visibility);
  }
  if (where.userId) return where.userId === row.userId;
  return true;
}

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/requireSession", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/revalidate", () => ({ safeRevalidateTag: vi.fn() }));

import { requireSession } from "@/lib/requireSession";

const sessionMock = requireSession as unknown as ReturnType<typeof vi.fn>;

const routePromise = import("@/app/api/documents/route");

describe("POST /api/documents", () => {
  beforeEach(() => {
    documents.length = 0;
    docSnippets.length = 0;
    prismaMock.snippet.findMany.mockClear();
    prismaMock.document.create.mockClear();
    prismaMock.documentSnippet.createMany.mockClear();
    prismaMock.$transaction.mockClear();
    sessionMock.mockReset();
  });

  it("requires auth", async () => {
    sessionMock.mockResolvedValue({ response: new Response("unauthorized", { status: 401 }) });
    const { POST } = await routePromise;
    const res = await POST(new Request("http://localhost/api/documents", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("creates document with snippet relations and overrides", async () => {
    sessionMock.mockResolvedValue({ session: { user: { id: "user-1" } } });
    const { POST } = await routePromise;
    const res = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: "My Doc",
          renderedContent: "# content",
          snippetIds: ["s2", "s1"],
          overrides: { s2: "Override" },
        }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.snippetIds).toEqual(["s2", "s1"]);
    expect(documents).toHaveLength(1);
    expect(docSnippets).toHaveLength(2);
    expect(docSnippets[0]).toMatchObject({ snippetId: "s2", position: 0, overrides: "Override" });
    expect(docSnippets[1]).toMatchObject({ snippetId: "s1", position: 1 });
  });

  it("rejects inaccessible snippets", async () => {
    sessionMock.mockResolvedValue({ session: { user: { id: "user-1" } } });
    const { POST } = await routePromise;
    const res = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify({ title: "Bad", snippetIds: ["missing"] }),
      })
    );
    expect(res.status).toBe(404);
  });
});
