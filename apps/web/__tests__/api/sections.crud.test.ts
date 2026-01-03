import { describe, it, expect, beforeEach, vi } from "vitest";

type SectionRecord = {
  id: string;
  title: string;
  content: string;
  order: number;
  userId: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

// In-memory store to simulate DB
const store: SectionRecord[] = [];

type WhereUser = { userId?: string };
type WhereId = { id: string; userId?: string };

const prismaMock = {
  snippet: {
    count: vi.fn(async ({ where }: { where?: WhereUser }) =>
      store.filter((s) => !where?.userId || s.userId === where.userId).length
    ),
    create: vi.fn(async ({ data }: { data: Omit<SectionRecord, "id" | "createdAt" | "updatedAt"> }) => {
      const created: SectionRecord = {
        id: `sec-${store.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        tags: data.tags ?? [],
      };
      store.push(created);
      return created;
    }),
    findMany: vi.fn(async ({ where, orderBy }: { where?: WhereUser; orderBy?: { order: "asc" }[] }) => {
      const items = store.filter((s) => !where?.userId || s.userId === where.userId);
      if (orderBy?.length) {
        return items.sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
      }
      return items;
    }),
    findFirst: vi.fn(async ({ where }: { where: WhereId }) =>
      store.find((s) => s.id === where.id && (!where.userId || s.userId === where.userId)) ?? null
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<SectionRecord> }) => {
      const idx = store.findIndex((s) => s.id === where.id);
      if (idx === -1) throw new Error("Not found");
      store[idx] = { ...store[idx], ...data, updatedAt: new Date() };
      return store[idx];
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const idx = store.findIndex((s) => s.id === where.id);
      if (idx === -1) throw new Error("Not found");
      const [removed] = store.splice(idx, 1);
      return removed;
    }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const authMock = vi.fn<() => Promise<{ user: { id: string } } | null>>();
vi.mock("@/lib/auth", () => ({ auth: authMock }));

// Route handlers under test
const routePromise = import("@/app/api/sections/route");
const routeWithIdPromise = import("@/app/api/sections/[id]/route");

type RouteContext = { params: Promise<{ id: string }> };

describe("sections API CRUD", () => {
  beforeEach(() => {
    store.length = 0;
    Object.values(prismaMock.snippet).forEach((fn) => {
      const maybe = fn as { mockClear?: () => void };
      maybe.mockClear?.();
    });
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("requires auth on list", async () => {
    authMock.mockResolvedValueOnce(null);
    const { GET } = await routePromise;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("creates and lists sections for the user", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const { POST, GET } = await routePromise;
    await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "First", content: "A" }),
      })
    );
    await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "Second", content: "B" }),
      })
    );

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(2);
    expect(json[0].order).toBe(0);
    expect(json[1].title).toBe("Second");
  });

  it("updates a section", async () => {
    const { POST } = await routePromise;
    const { PUT } = await routeWithIdPromise;

    const createdRes = await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "Edit me", content: "Old" }),
      })
    );
    const created = await createdRes.json();
    const ctx: RouteContext = { params: Promise.resolve({ id: created.id }) };

    const res = await PUT(
      new Request("http://localhost/api/sections/id", {
        method: "PUT",
        body: JSON.stringify({ title: "New title", content: "New content" }),
      }),
      ctx
    );
    const updated = await res.json();
    expect(res.status).toBe(200);
    expect(updated.title).toBe("New title");
    expect(updated.content).toBe("New content");
  });

  it("normalizes tags on create and update", async () => {
    const { POST } = await routePromise;
    const { PUT } = await routeWithIdPromise;

    const createdRes = await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "Tags", content: "Body", tags: ["System Prompt"] }),
      })
    );
    const created = await createdRes.json();
    expect(created.tags).toEqual(["system-prompt"]);

    const ctx: RouteContext = { params: Promise.resolve({ id: created.id }) };
    const res = await PUT(
      new Request("http://localhost/api/sections/id", {
        method: "PUT",
        body: JSON.stringify({ tags: ["Style Guide", "Style Guide"] }),
      }),
      ctx
    );
    const updated = await res.json();
    expect(updated.tags).toEqual(["style-guide"]);
  });

  it("deletes a section", async () => {
    const { POST } = await routePromise;
    const { DELETE } = await routeWithIdPromise;

    const createdRes = await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "Delete me", content: "Bye" }),
      })
    );
    const created = await createdRes.json();
    const ctx: RouteContext = { params: Promise.resolve({ id: created.id }) };

    const res = await DELETE(new Request("http://localhost/api/sections/id"), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(store).toHaveLength(0);
  });
});
