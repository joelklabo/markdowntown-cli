import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { normalizeTags } from "@/lib/tags";

export type SectionRecord = {
  id: string;
  slug?: string | null;
  title: string;
  content: string;
  tags: string[];
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface SectionsRepo {
  listPublic(input?: {
    tags?: string[];
    search?: string | null;
    limit?: number;
  }): Promise<SectionRecord[]>;
  findByIdOrSlug(idOrSlug: string): Promise<SectionRecord | null>;
}

class PrismaSectionsRepo implements SectionsRepo {
  async listPublic(input: { tags?: string[]; search?: string | null; limit?: number } = {}): Promise<SectionRecord[]> {
    if (!hasDatabaseEnv) return [];
    const { tags = [], search = null, limit = 60 } = input;
    const where: NonNullable<Parameters<typeof prisma.snippet.findMany>[0]>["where"] = {
      visibility: "PUBLIC",
    };
    if (tags.length) where.tags = { hasEvery: tags };
    if (search) where.title = { contains: search, mode: "insensitive" };

    const rows = await prisma.snippet.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return rows.map((r) => ({ ...r, tags: normalizeTags(r.tags, { strict: false }).tags }));
  }

  async findByIdOrSlug(idOrSlug: string): Promise<SectionRecord | null> {
    const row = await prisma.snippet.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], visibility: "PUBLIC" },
    });
    return row ? { ...row, tags: normalizeTags(row.tags, { strict: false }).tags } : null;
  }
}

export function createPrismaSectionsRepo(): SectionsRepo {
  return new PrismaSectionsRepo();
}
