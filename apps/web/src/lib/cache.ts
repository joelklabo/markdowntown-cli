import { cache } from "react";
import { prisma } from "./prisma";

// Cached fetch of user sections with ordering
export const getSectionsCached = cache(async (userId: string) => {
  return prisma.snippet.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
});

export function memoize<F extends (...args: unknown[]) => Promise<unknown> | unknown>(fn: F) {
  const store = new Map<string, Promise<unknown> | unknown>();
  return async (key: string, ...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    if (store.has(key)) return store.get(key) as Awaited<ReturnType<F>>;
    const result = fn(...args);
    store.set(key, result);
    return result as Awaited<ReturnType<F>>;
  };
}
