import { describe, it, expect, vi } from "vitest";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
  hasDatabaseEnv: false,
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: {
      name: "Test User",
      email: "test@example.com",
      image: "",
    },
    expires: new Date(Date.now() + 86400 * 1000).toISOString(),
  })),
}));

describe("auth", () => {
  it("should return a session", async () => {
    const session = await getServerSession(authOptions);
    expect(session).not.toBeNull();
    expect(session?.user?.name).toBe("Test User");
  });
});
