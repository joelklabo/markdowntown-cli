import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { hasDatabaseEnv, prisma } from "./prisma";
import { normalizeTags } from "./tags";
import { cacheTags } from "./cacheTags";

export type PublicTag = { tag: string; count: number };

const isTestEnv = process.env.NODE_ENV === "test";

async function queryTags(limit: number, windowDays?: number | null): Promise<PublicTag[]> {
  if (!hasDatabaseEnv) return [];
  const whereWindow = windowDays
    ? Prisma.sql`AND "updatedAt" > NOW() - (${windowDays}::int * INTERVAL '1 day')`
    : Prisma.empty;

  let results: { tag: string; count: bigint }[] = [];
  try {
    results = await prisma.$queryRaw<
      { tag: string; count: bigint }[]
    >(Prisma.sql`
      SELECT tag, COUNT(*)::int AS count
      FROM (
        SELECT unnest("tags") AS tag FROM "Artifact" WHERE "visibility" = 'PUBLIC' ${whereWindow}
      ) AS t
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ${limit};
    `);
  } catch (err) {
    console.warn("publicTags: falling back to empty list", err);
    return [];
  }

  const aggregated = new Map<string, number>();

  results.forEach((row) => {
    const normalized = normalizeTags([row.tag], { strict: false }).tags[0];
    if (!normalized) return;
    aggregated.set(normalized, (aggregated.get(normalized) ?? 0) + Number(row.count));
  });

  return Array.from(aggregated.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export async function listTopTags(limit = 50, windowDays?: number | null) {
  if (isTestEnv) return queryTags(limit, windowDays);
  const cached = unstable_cache(
    (l: number, window: number | null | undefined) => queryTags(l, window),
    ["public-tags"],
    { revalidate: 300, tags: [cacheTags.tags, cacheTags.landing] }
  );
  return cached(limit, windowDays);
}

export async function listSpotlightTags(limit = 20) {
  // Spotlight favors recent activity (7d)
  if (isTestEnv) return queryTags(limit, 7);
  const cached = unstable_cache(
    (l: number) => queryTags(l, 7),
    ["public-tags-spotlight"],
    { revalidate: 300, tags: [cacheTags.tags, cacheTags.landing] }
  );
  return cached(limit);
}
