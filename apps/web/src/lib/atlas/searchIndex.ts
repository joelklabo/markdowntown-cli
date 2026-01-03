import index from "./index.generated.json";

export type AtlasSearchItemKind = "platform" | "artifact" | "claim" | "guide" | "example";

export type AtlasSearchItem = {
  id: string;
  kind: AtlasSearchItemKind;
  title: string;
  filePath: string;
  platformId?: string;
  artifactKind?: string;
  claimId?: string;
  guideKind?: "concepts" | "recipes";
  slug?: string;
  fileName?: string;
  paths?: string[];
};

export type AtlasSearchIndex = {
  schemaVersion: 1;
  generatedAt: string;
  items: AtlasSearchItem[];
};

function loadAtlasSearchIndex(): AtlasSearchIndex {
  return index as AtlasSearchIndex;
}

export type AtlasSearchResultKind = "platform" | "claim" | "path" | "guide" | "recipe";

export type AtlasSearchResult = {
  id: string;
  kind: AtlasSearchResultKind;
  title: string;
  subtitle?: string;
  href: string;
};

type SearchEntry = {
  result: AtlasSearchResult;
  haystack: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreMatch(haystack: string, tokens: string[]): number | null {
  let score = 0;
  for (const token of tokens) {
    const idx = haystack.indexOf(token);
    if (idx < 0) return null;
    score += idx;
  }
  if (tokens.length > 0 && haystack.startsWith(tokens[0]!)) score -= 8;
  return score;
}

function buildEntries(searchIndex: AtlasSearchIndex): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const item of searchIndex.items) {
    if (item.kind === "platform" && item.platformId) {
      const href = `/atlas/platforms/${encodeURIComponent(item.platformId)}`;
      entries.push({
        result: {
          id: item.id,
          kind: "platform",
          title: item.title,
          subtitle: item.platformId,
          href,
        },
        haystack: normalize([item.title, item.platformId].join(" ")),
      });
      continue;
    }

    if (item.kind === "claim" && item.platformId && item.claimId) {
      const href = `/atlas/platforms/${encodeURIComponent(item.platformId)}#claims`;
      entries.push({
        result: {
          id: item.id,
          kind: "claim",
          title: item.title,
          subtitle: `${item.platformId} · ${item.claimId}`,
          href,
        },
        haystack: normalize([item.title, item.platformId, item.claimId].join(" ")),
      });
      continue;
    }

    if (item.kind === "guide" && item.slug && item.guideKind) {
      const isRecipe = item.guideKind === "recipes";
      const href = isRecipe
        ? `/atlas/recipes/${encodeURIComponent(item.slug)}`
        : `/atlas/concepts/${encodeURIComponent(item.slug)}`;
      entries.push({
        result: {
          id: item.id,
          kind: isRecipe ? "recipe" : "guide",
          title: item.title,
          subtitle: item.guideKind,
          href,
        },
        haystack: normalize([item.title, item.slug, item.guideKind].join(" ")),
      });
      continue;
    }

    if (item.kind === "artifact" && item.platformId && item.paths) {
      for (const pathItem of item.paths) {
        const pathValue = pathItem.trim();
        if (!pathValue) continue;
        const href = `/atlas/platforms/${encodeURIComponent(item.platformId)}#artifacts`;
        entries.push({
          result: {
            id: `path:${item.platformId}:${item.artifactKind ?? "artifact"}:${pathValue}`,
            kind: "path",
            title: pathValue,
            subtitle: item.title ? `${item.platformId} · ${item.title}` : item.platformId,
            href,
          },
          haystack: normalize([pathValue, item.title, item.platformId, item.artifactKind].filter(Boolean).join(" ")),
        });
      }
      continue;
    }
  }

  return entries;
}

export function searchAtlas(
  query: string,
  options?: {
    index?: AtlasSearchIndex;
    limit?: number;
  }
): AtlasSearchResult[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/g).filter(Boolean);
  if (tokens.length === 0) return [];

  const searchIndex = options?.index ?? loadAtlasSearchIndex();
  const entries = buildEntries(searchIndex);

  const kindOrder: Record<AtlasSearchResultKind, number> = {
    platform: 0,
    guide: 1,
    recipe: 2,
    claim: 3,
    path: 4,
  };

  const scored: Array<{ entry: SearchEntry; score: number }> = [];
  for (const entry of entries) {
    const score = scoreMatch(entry.haystack, tokens);
    if (score === null) continue;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const kindA = kindOrder[a.entry.result.kind] ?? 99;
    const kindB = kindOrder[b.entry.result.kind] ?? 99;
    if (kindA !== kindB) return kindA - kindB;
    return a.entry.result.title.localeCompare(b.entry.result.title);
  });

  const limit = options?.limit ?? 12;
  return scored.slice(0, limit).map((item) => item.entry.result);
}

export type AtlasPaletteHit = {
  id: string;
  label: string;
  hint: string;
  href: string;
};

export function searchAtlasPaletteHits(
  query: string,
  options?: {
    index?: AtlasSearchIndex;
    limit?: number;
  }
): AtlasPaletteHit[] {
  const hits = searchAtlas(query, { index: options?.index, limit: options?.limit ?? 10 }).filter(
    (result) => result.kind !== "path"
  );

  const labelForKind: Record<Exclude<AtlasSearchResultKind, "path">, string> = {
    platform: "Platform",
    claim: "Claim",
    guide: "Guide",
    recipe: "Recipe",
  };

  return hits.map((result) => ({
    id: result.id,
    label: result.title,
    hint: labelForKind[result.kind as Exclude<AtlasSearchResultKind, "path">] ?? "Atlas",
    href: result.href,
  }));
}
