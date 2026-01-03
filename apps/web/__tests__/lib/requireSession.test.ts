import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/requireSession";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;

describe("requireSession helper", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns 401 response when session is missing", async () => {
    authMock.mockResolvedValue(null);

    const result = await requireSession();

    expect(result.session).toBeUndefined();
    expect(result.response?.status).toBe(401);
    expect(result.response?.headers.get("cache-control")).toContain("no-store");
    expect(result.response?.headers.get("vary")).toBe("Cookie");
  });

  it("returns session when present", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const result = await requireSession();

    expect(result.response).toBeUndefined();
    expect(result.session?.user.id).toBe("user-1");
  });
});
