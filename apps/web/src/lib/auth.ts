import { getServerSession } from "next-auth";
import type { LoggerInstance, NextAuthOptions } from "next-auth";
import GithubProvider, { type GithubProfile } from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { hasDatabaseEnv, prisma } from "./prisma";

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXTAUTH_SECRET } = process.env;
const githubConfigured = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
const githubClientId = GITHUB_CLIENT_ID ?? "missing-client-id";
const githubClientSecret = GITHUB_CLIENT_SECRET ?? "missing-client-secret";
// Keep demo login available in all environments unless explicitly disabled by env.
const demoLoginEnabled = process.env.DEMO_LOGIN_DISABLED !== "true";
const demoPassword = process.env.DEMO_LOGIN_PASSWORD ?? "demo-login";
const useDatabaseAdapter = hasDatabaseEnv && githubConfigured;
const sessionStrategy: "jwt" | "database" = useDatabaseAdapter ? "database" : "jwt";
const authLogger: Partial<LoggerInstance> | undefined =
  process.env.NEXTAUTH_DEBUG === "true"
    ? {
        error(code, metadata) {
          console.error("[next-auth]", code, metadata);
        },
        warn(code) {
          console.warn("[next-auth]", code);
        },
        debug(code, metadata) {
          console.debug("[next-auth]", code, metadata);
        },
      }
    : undefined;

async function getOrCreateDemoUser() {
  if (!useDatabaseAdapter) {
    return {
      id: "demo-user",
      name: "Demo User",
      email: "demo@markdown.town",
      username: "demo",
      image: null,
    };
  }
  return prisma.user.upsert({
    where: { email: "demo@markdown.town" },
    update: { username: "demo" },
    create: {
      id: "demo-user",
      email: "demo@markdown.town",
      name: "Demo User",
      username: "demo",
      image: null,
    },
  });
}

const baseProviders = [
  GithubProvider({
    clientId: githubClientId,
    clientSecret: githubClientSecret,
    profile(profile) {
      return {
        id: profile.id.toString(),
        name: profile.name ?? profile.login,
        email: profile.email,
        image: profile.avatar_url,
        username: profile.login,
        githubId: profile.id.toString(),
      };
    },
  }),
];

const providers = demoLoginEnabled
  ? [
      ...baseProviders,
      CredentialsProvider({
        id: "demo",
        name: "Demo login",
        credentials: {
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!demoLoginEnabled) return null;
          const provided = credentials?.password ?? "";
          if (provided !== demoPassword) return null;
          const user = await getOrCreateDemoUser();
          return {
            id: user.id,
            name: user.name ?? "Demo User",
            email: user.email ?? "demo@markdown.town",
            image: user.image ?? null,
            username: user.username ?? "demo",
          };
        },
      }),
    ]
  : baseProviders;

export const authOptions: NextAuthOptions = hasDatabaseEnv
  ? {
      adapter: useDatabaseAdapter ? PrismaAdapter(prisma) : undefined,
      providers,
      pages: { signIn: "/signin" },
      session: { strategy: sessionStrategy },
      secret: NEXTAUTH_SECRET ?? "development-secret",
      debug: process.env.NEXTAUTH_DEBUG === "true",
      logger: authLogger,
      callbacks: {
        async signIn({ account }) {
          if (account?.provider === "github" && !githubConfigured) {
            console.warn("GitHub OAuth is not configured. Set GITHUB_CLIENT_ID/SECRET to enable it.");
            return "/signin?error=github_not_configured";
          }
          return true;
        },
        async session({ session, user, token }) {
          if (session.user) {
            session.user.id = user?.id ?? (token.sub as string | undefined) ?? session.user.id;
            session.user.username =
              user?.username ?? user?.name ?? user?.email ?? session.user.email ?? "";
            session.user.image = (user as { avatarUrl?: string })?.avatarUrl ?? user?.image ?? session.user.image;
          }
          return session;
        },
      },
      events: useDatabaseAdapter
        ? {
            // Ensure GitHub metadata is persisted on first login.
            async signIn({ user, profile }) {
              if (!profile) return;
              const ghProfile = profile as GithubProfile | undefined;
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  githubId: ghProfile?.id?.toString(),
                  username:
                    user.username ??
                    ghProfile?.login ??
                    ghProfile?.name ??
                    user.email ??
                    user.name,
                  avatarUrl: ghProfile?.avatar_url ?? user.image ?? undefined,
                  name: ghProfile?.name ?? user.name,
                  image: ghProfile?.avatar_url ?? user.image ?? undefined,
                },
              });
            },
          }
        : undefined,
    }
  : {
      providers,
      session: { strategy: "jwt" },
      secret: NEXTAUTH_SECRET ?? "development-secret",
      pages: { signIn: "/signin" },
      debug: process.env.NEXTAUTH_DEBUG === "true",
      logger: authLogger,
      callbacks: {
        async signIn({ account }) {
          if (account?.provider === "github" && !githubConfigured) {
            console.warn("GitHub OAuth is not configured. Set GITHUB_CLIENT_ID/SECRET to enable it.");
            return "/signin?error=github_not_configured";
          }
          return true;
        },
      },
    };

export const getSession = async () => {
  try {
    return await getServerSession(authOptions);
  } catch (err) {
    console.warn("getSession: returning null due to auth error", err);
    return null;
  }
};
export const auth = getSession;
