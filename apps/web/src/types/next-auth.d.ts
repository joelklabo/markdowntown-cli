import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string | null;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string | null;
    avatarUrl?: string | null;
    githubId?: string | null;
  }
}
