import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const countMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    snippet: {
      count: countMock,
      create: createMock,
    },
  },
}));

describe("POST /api/sections validation", () => {
  beforeEach(() => {
    countMock.mockReset();
    createMock.mockReset();
    countMock.mockResolvedValue(0);
    createMock.mockResolvedValue({
      id: "sec-1",
      title: "Ok",
      content: "",
      order: 0,
      userId: "user-1",
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects disallowed markup", async () => {
    const { POST } = await import("@/app/api/sections/route");
    const res = await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "Bad", content: "<script>alert(1)</script>" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/disallowed markup/i);
  });

  it("accepts valid payload", async () => {
    const { POST } = await import("@/app/api/sections/route");
    const res = await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ title: "Hello", content: "Content" }),
      })
    );
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("rejects too many tags", async () => {
    const { POST } = await import("@/app/api/sections/route");
    const res = await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({
          title: "Tags",
          content: "Content",
          tags: Array.from({ length: 9 }, (_, i) => `tag-${i}`),
        }),
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too many tags/i);
  });

  it("normalizes tags on create", async () => {
    const { POST } = await import("@/app/api/sections/route");
    await POST(
      new Request("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({
          title: "Tags",
          content: "Content",
          tags: ["System Prompt", "Style"],
        }),
      })
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tags: ["system-prompt", "style"] }),
      })
    );
  });
});
