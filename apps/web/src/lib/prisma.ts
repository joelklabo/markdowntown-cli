import { PrismaClient } from "@prisma/client";

// Re-use Prisma client across hot reloads in development.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const skipDb = process.env.SKIP_DB === "1";
const databaseUrl = process.env.DATABASE_URL;
// Only treat DB as available when a Postgres URL is configured.
export const hasDatabaseEnv =
  !skipDb && typeof databaseUrl === "string" && /^(postgresql|postgres):\/\//.test(databaseUrl);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from "@prisma/client";
