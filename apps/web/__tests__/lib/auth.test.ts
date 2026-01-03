import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getServerSession } from "next-auth";
import { getSession } from "@/lib/auth";

vi.mock("next-auth", () => {
  const getServerSessionMock = vi.fn();
  return { __esModule: true, getServerSession: getServerSessionMock };
});

const getServerSessionMock = getServerSession as unknown as ReturnType<typeof vi.fn>;

describe("getSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when auth returns null", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns session when present", async () => {
    const fakeSession = { user: { id: "u1", name: "Name" } } as { user: { id: string; name: string } };
    getServerSessionMock.mockResolvedValueOnce(fakeSession);
    const session = await getSession();
    expect(session).toEqual(fakeSession);
  });
});
