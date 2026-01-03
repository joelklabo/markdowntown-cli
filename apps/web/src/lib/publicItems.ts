import { normalizeTags } from "./tags";
import { unstable_cache } from "next/cache";
import { cacheTags, type PublicListType } from "./cacheTags";
import { prisma, hasDatabaseEnv } from "@/lib/prisma";
import { ArtifactType, Prisma } from "@prisma/client";
import { safeParseUamV1 } from "@/lib/uam/uamValidate";

const isTestEnv = process.env.NODE_ENV === "test";
const isDevEnv = process.env.NODE_ENV === "development";

const DEMO_ITEM_SLUG = "visual-demo";

function demoPublicItemDetail(slug: string): PublicItemDetail | null {
  if (slug !== DEMO_ITEM_SLUG) return null;

  const content = {
    schemaVersion: 1,
    meta: {
      title: "Visual Demo Artifact",
      description: "Deterministic demo artifact used for local visual snapshots.",
      license: "MIT",
    },
    scopes: [
      { id: "global", kind: "global", name: "Global" },
      { id: "src", kind: "dir", dir: "src", name: "Source" },
    ],
    blocks: [
      {
        id: "block-global",
        scopeId: "global",
        kind: "markdown",
        title: "System",
        body: "You are a precise, friendly coding assistant. Keep responses concise and actionable.",
      },
      {
        id: "block-src",
        scopeId: "src",
        kind: "checklist",
        title: "Quality bar",
        body: "- Run `pnpm test`\n- Run `pnpm lint`\n- Update docs when behavior changes",
      },
    ],
    capabilities: [],
    targets: [{ targetId: "agents-md" }, { targetId: "github-copilot" }],
  };

  const counts = countsFromUam(content);
  const createdAt = new Date("2025-12-10T12:00:00Z");
  const updatedAt = new Date("2025-12-15T12:00:00Z");

  return {
    ...counts,
    id: DEMO_ITEM_SLUG,
    slug: DEMO_ITEM_SLUG,
    title: "Visual Demo Artifact",
    description: "A stable artifact used to validate /a/[slug] layout in visual regression tests.",
    tags: ["visual", "demo", "workbench"],
    targets: ["agents-md", "github-copilot"],
    hasScopes: true,
    lintGrade: "A",
    stats: { views: 1420, copies: 310, votes: 64 },
    type: "agent",
    createdAt,
    updatedAt,
    content,
    version: "1",
  };
}

export type PublicItemType = "snippet" | "template" | "file" | "agent" | "skill";

export type PublicItem = {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  tags: string[];
  targets: string[];
  hasScopes: boolean;
  lintGrade: string | null;
  scopeCount: number;
  blockCount: number;
  stats: { views: number; copies: number; votes: number };
  type: PublicItemType;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicItemDetail = PublicItem & {
  content: unknown;
  version: string;
};

export type ListPublicItemsInput = {
  limit?: number;
  tags?: unknown;
  targets?: unknown;
  hasScopes?: unknown;
  type?: PublicItemType | "all";
  sort?: "recent" | "views" | "copies";
  search?: string | null;
};

function normalizeInputTags(input?: unknown): string[] {
  return normalizeTags(input, { strict: false }).tags;
}

function normalizeInputTargets(input?: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeInputHasScopes(input?: unknown): boolean | undefined {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return undefined;
}

const artifactTypeByPublicType: Record<PublicItemType, ArtifactType> = {
  snippet: "MODULE",
  template: "TEMPLATE",
  file: "ARTIFACT",
  agent: "ARTIFACT",
  skill: "SKILL",
};

function toPublicType(t: ArtifactType): PublicItemType {
  if (t === "TEMPLATE") return "template";
  if (t === "MODULE") return "snippet";
  if (t === "SKILL") return "skill";
  return "agent";
}

function countsFromUam(raw: unknown): { scopeCount: number; blockCount: number } {
  const parsed = safeParseUamV1(raw);
  if (!parsed.success) return { scopeCount: 0, blockCount: 0 };
  return { scopeCount: parsed.data.scopes.length, blockCount: parsed.data.blocks.length };
}

async function listPublicItemsRaw(input: ListPublicItemsInput = {}): Promise<PublicItem[]> {
  const { limit = 30, tags = [], type = "all", sort = "recent", search = null } = input;
  const normalizedTags = normalizeInputTags(tags);
  const normalizedTargets = normalizeInputTargets(input.targets);
  const hasScopesFilter = normalizeInputHasScopes(input.hasScopes);

  if (!hasDatabaseEnv) {
    if (!isDevEnv) return [];
    const demo = demoPublicItemDetail(DEMO_ITEM_SLUG);
    if (!demo) return [];

    const demoItem: PublicItem = {
      id: demo.id,
      slug: demo.slug,
      title: demo.title,
      description: demo.description,
      tags: demo.tags,
      targets: demo.targets,
      hasScopes: demo.hasScopes,
      lintGrade: demo.lintGrade,
      scopeCount: demo.scopeCount,
      blockCount: demo.blockCount,
      stats: demo.stats,
      type: demo.type,
      createdAt: demo.createdAt,
      updatedAt: demo.updatedAt,
    };

    if (type !== "all" && demoItem.type !== type) return [];
    if (normalizedTags.length > 0 && !normalizedTags.some((tag) => demoItem.tags.includes(tag))) return [];
    if (normalizedTargets.length > 0 && !normalizedTargets.some((target) => demoItem.targets.includes(target))) return [];
    if (hasScopesFilter !== undefined && demoItem.hasScopes !== hasScopesFilter) return [];
    if (search) {
      const needle = search.toLowerCase();
      const matches = demoItem.title.toLowerCase().includes(needle) || demoItem.description.toLowerCase().includes(needle);
      if (!matches) return [];
    }

    return [demoItem].slice(0, Math.min(limit, 100));
  }

  const where: Prisma.ArtifactWhereInput = {
    visibility: "PUBLIC",
  };

  if (type !== "all" && artifactTypeByPublicType[type]) {
    where.type = artifactTypeByPublicType[type];
  }

  if (normalizedTags.length > 0) {
    where.tags = { hasSome: normalizedTags };
  }

  if (normalizedTargets.length > 0) {
    where.targets = { hasSome: normalizedTargets };
  }

  if (hasScopesFilter !== undefined) {
    where.hasScopes = hasScopesFilter;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ArtifactOrderByWithRelationInput = {};
  if (sort === "views") orderBy.views = "desc";
  else if (sort === "copies") orderBy.copies = "desc";
  else orderBy.createdAt = "desc";

  try {
    const artifacts = await prisma.artifact.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy,
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { uam: true },
        },
      },
    });

    return artifacts.map(a => ({
      ...countsFromUam(a.versions[0]?.uam),
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: (a.description ?? "").slice(0, 240),
      tags: normalizeTags(a.tags, { strict: false }).tags,
      targets: a.targets,
      hasScopes: a.hasScopes,
      lintGrade: a.lintGrade ?? null,
      stats: {
        views: a.views,
        copies: a.copies,
        votes: a.votesUp || 0,
      },
      type: toPublicType(a.type),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  } catch (err) {
    console.warn("publicItems: error fetching artifacts", err);
    return [];
  }
}

async function getPublicItemRaw(slug: string): Promise<PublicItemDetail | null> {
  if (!hasDatabaseEnv) {
    if (isDevEnv) return demoPublicItemDetail(slug);
    return null;
  }

  try {
    const artifact = await prisma.artifact.findFirst({
      where: {
        OR: [{ id: slug }, { slug }],
        visibility: "PUBLIC",
      },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!artifact) return null;
    const latest = artifact.versions[0];
    const counts = countsFromUam(latest?.uam);
    const updatedAt = latest?.createdAt ?? artifact.updatedAt ?? artifact.createdAt;

    return {
      ...counts,
      id: artifact.id,
      slug: artifact.slug,
      title: artifact.title,
      description: artifact.description ?? "",
      tags: artifact.tags,
      targets: artifact.targets,
      hasScopes: artifact.hasScopes,
      lintGrade: artifact.lintGrade ?? null,
      stats: {
        views: artifact.views,
        copies: artifact.copies,
        votes: artifact.votesUp || 0,
      },
      type: toPublicType(artifact.type),
      createdAt: artifact.createdAt,
      updatedAt,
      content: latest?.uam ?? {},
      version: latest?.version ?? "draft",
    };
  } catch (err) {
    console.warn("getPublicItem: error", err);
    return null;
  }
}

const listCache = new Map<string, ReturnType<typeof unstable_cache>>();

function getListCache(type: string) {
  if (!listCache.has(type)) {
    listCache.set(
      type,
      unstable_cache(
        async (input: ListPublicItemsInput = {}) => listPublicItemsRaw({ ...input, type: type as ListPublicItemsInput["type"] }),
        ["public-items", type],
        { revalidate: 60, tags: [cacheTags.list("all"), cacheTags.list(type as PublicListType), cacheTags.landing] }
      )
    );
  }
  return listCache.get(type)!;
}

export async function listPublicItems(input: ListPublicItemsInput = {}): Promise<PublicItem[]> {
  const type = input.type ?? "all";
  if (isTestEnv) return listPublicItemsRaw(input);
  const cached = getListCache(type);
  return cached(input);
}

const detailCache = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getPublicItem(slug: string): Promise<PublicItemDetail | null> {
  if (isTestEnv) return getPublicItemRaw(slug);
  const key = `detail:${slug}`;
  if (!detailCache.has(key)) {
    detailCache.set(
      key,
      unstable_cache(async (s: string) => getPublicItemRaw(s), ["public-item-detail", slug], {
        revalidate: 60,
        tags: [cacheTags.detail("all", slug)],
      })
    );
  }
  return detailCache.get(key)!(slug);
}
