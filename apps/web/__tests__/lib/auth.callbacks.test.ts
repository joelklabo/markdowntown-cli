import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Account } from "next-auth";

const prismaUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: prismaUpdate,
    },
  },
  hasDatabaseEnv: true,
}));

function loadAuthWithEnv(env: Partial<NodeJS.ProcessEnv>) {
  const original = { ...process.env };
  Object.assign(process.env, env);
  vi.resetModules();
  return import("@/lib/auth").finally(() => {
    process.env = original;
  });
}

describe("auth callbacks", () => {
  beforeEach(() => {
    prismaUpdate.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("blocks GitHub sign-in when OAuth is not configured", async () => {
    const { authOptions } = await loadAuthWithEnv({
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
    });

    const allowed = await authOptions.callbacks?.signIn?.({
      user: { id: "u1", emailVerified: null },
      account: { provider: "github", type: "oauth", providerAccountId: "1" } as Account,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(allowed).not.toBe(true);
  });

  it("allows sign-in when GitHub OAuth is configured", async () => {
    const { authOptions } = await loadAuthWithEnv({
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
    });

    const allowed = await authOptions.callbacks?.signIn?.({
      user: { id: "u1", emailVerified: null },
      account: null,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(allowed).toBe(true);
  });

  it("populates session user fields", async () => {
    const { authOptions } = await loadAuthWithEnv({
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
    });

    const sessionFn = authOptions.callbacks?.session;
    const result = await sessionFn?.({
      session: {
        user: {
          id: "",
          email: "me@example.com",
          name: "Me",
          image: undefined,
          username: undefined,
        },
        expires: "",
      },
      user: {
        id: "user-1",
        username: "mdtuser",
        email: "me@example.com",
        name: "Full Name",
        image: "https://img",
        emailVerified: null,
      },
      token: {},
      newSession: null,
      trigger: "update",
    });

    expect(result?.user?.id).toBe("user-1");
    expect(result?.user?.username).toBe("mdtuser");
    expect(result?.user?.image).toBe("https://img");
  });

  it("updates persisted GitHub metadata on sign-in event", async () => {
    const { authOptions } = await loadAuthWithEnv({
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
    });

    const ghProfile = {
      id: 42,
      login: "mdtuser",
      avatar_url: "https://avatar",
      name: "Full Name",
      email: "me@example.com",
    } as unknown as import("next-auth").Profile;

    await authOptions.events?.signIn?.({
      user: {
        id: "user-1",
        username: "mdtuser",
        email: "me@example.com",
        name: "Full Name",
        image: "https://img",
      },
      profile: ghProfile,
      account: {
        provider: "github",
        type: "oauth",
        providerAccountId: "42",
        access_token: "token",
        token_type: "bearer",
      },
      isNewUser: true,
    });

    expect(prismaUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
        data: expect.objectContaining({
          githubId: "42",
          username: "mdtuser",
          avatarUrl: "https://avatar",
          name: "Full Name",
          image: "https://avatar",
        }),
    });
  });
});
