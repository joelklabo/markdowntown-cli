import { describe, it, expect, beforeEach, vi } from "vitest";

const snippetsStore = [
  { id: "s1", title: "Alpha", content: "A content", visibility: "PUBLIC", userId: null },
  { id: "s2", title: "Beta", content: "B content", visibility: "PRIVATE", userId: "user-1" },
];

const templateStore = [
  { id: "t1", title: "Template", description: "Desc", body: "Body", visibility: "PUBLIC", userId: null },
];

type WhereInput = {
  id?: { in?: string[] };
  OR?: WhereInput[];
  visibility?: { in?: string[] };
  userId?: string;
};

const prismaMock = {
  snippet: {
    findMany: vi.fn(async ({ where }: { where: WhereInput }) => {
      const ids: string[] = where.id?.in ?? [];
      return snippetsStore.filter((s) => ids.includes(s.id) && filterVisibility(where, s));
    }),
  },
  template: {
    findFirst: vi.fn(async ({ where }: { where: WhereInput }) => {
      const tpl = templateStore.find((t) => t.id === where.id);
      if (!tpl) return null;
      return filterVisibility(where, tpl) ? tpl : null;
    }),
  },
};

function filterVisibility(where: WhereInput, row: { visibility: string; userId: string | null }) {
  if (where.OR) {
    return where.OR.some((cond) => matchesVisibility(cond, row));
  }
  return matchesVisibility(where, row);
}

function matchesVisibility(cond: WhereInput, row: { visibility: string; userId: string | null }) {
  if (cond.visibility?.in) {
    return cond.visibility.in.includes(row.visibility);
  }
  if (cond.userId) return cond.userId === row.userId;
  return true;
}

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;

const routePromise = import("@/app/api/builder/render/route");

describe("POST /api/builder/render", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(null);
    prismaMock.snippet.findMany.mockClear();
    prismaMock.template.findFirst.mockClear();
  });

  it("renders template + public snippets for anonymous users", async () => {
    const { POST } = await routePromise;
    const res = await POST(
      new Request("http://localhost/api/builder/render", {
        method: "POST",
        body: JSON.stringify({ templateId: "t1", snippetIds: ["s1"] }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rendered).toContain("# Template");
    expect(json.rendered).toContain("## Alpha");
    expect(json.hasPrivateContent).toBe(false);
    expect(json.missingSnippetIds).toEqual([]);
  });

  it("flags private snippets when owned by the user", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const { POST } = await routePromise;
    const res = await POST(
      new Request("http://localhost/api/builder/render", {
        method: "POST",
        body: JSON.stringify({ snippetIds: ["s2"] }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rendered).toContain("## Beta");
    expect(json.hasPrivateContent).toBe(true);
  });

  it("returns 404 when no snippets are accessible", async () => {
    const { POST } = await routePromise;
    const res = await POST(
      new Request("http://localhost/api/builder/render", {
        method: "POST",
        body: JSON.stringify({ snippetIds: ["missing"] }),
      })
    );
    expect(res.status).toBe(404);
  });
});
