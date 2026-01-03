import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/items/route";
import { resetRateLimitStore } from "@/lib/rateLimiter";
import { listPublicItems } from "@/lib/publicItems";

vi.mock("@/lib/publicItems", () => ({
  listPublicItems: vi.fn(),
}));

describe("GET /api/public/items", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.clearAllMocks();
  });

  it("forwards parsed filters to listPublicItems", async () => {
    (listPublicItems as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new Request(
      "http://localhost/api/public/items?limit=250&sort=views&type=template&q=hello&tags=System%20Prompt&targets=agents-md,github-copilot&hasScopes=true",
      { headers: { "x-forwarded-for": "ip1" } }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(listPublicItems).toHaveBeenCalledWith({
      limit: 200,
      sort: "views",
      type: "template",
      search: "hello",
      tags: ["system-prompt"],
      targets: ["agents-md", "github-copilot"],
      hasScopes: true,
    });
  });

  it("ignores invalid hasScopes", async () => {
    (listPublicItems as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new Request("http://localhost/api/public/items?hasScopes=maybe", {
      headers: { "x-forwarded-for": "ip2" },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const call = (listPublicItems as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      hasScopes?: unknown;
    };
    expect(call.hasScopes).toBeUndefined();
  });
});

