import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/atlas/search/route";
import { resetRateLimitStore } from "@/lib/rateLimiter";
import { searchAtlas } from "@/lib/atlas/searchIndex";

vi.mock("@/lib/atlas/searchIndex", () => ({
  searchAtlas: vi.fn(),
}));

describe("GET /api/atlas/search", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.clearAllMocks();
  });

  it("rejects missing q", async () => {
    const req = new Request("http://localhost/api/atlas/search", { headers: { "x-forwarded-for": "ip1" } });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Missing query", items: [] });
  });

  it("returns top hits", async () => {
    (searchAtlas as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: "p1", kind: "platform", title: "GitHub Copilot", href: "/atlas/platforms/github-copilot" },
    ]);

    const req = new Request("http://localhost/api/atlas/search?q=copilot&limit=5", {
      headers: { "x-forwarded-for": "ip2" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(searchAtlas).toHaveBeenCalledWith("copilot", { limit: 5 });

    const body = await res.json();
    expect(body).toEqual({
      items: [{ type: "platform", title: "GitHub Copilot", href: "/atlas/platforms/github-copilot" }],
    });
  });
});

