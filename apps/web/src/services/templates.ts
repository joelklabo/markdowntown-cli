import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { normalizeTags } from "@/lib/tags";

export type TemplateRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  fields: unknown;
  tags: string[];
  views: number;
  copies: number;
  downloads: number;
  uses: number;
  createdAt: Date;
  updatedAt: Date;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
};

export interface TemplatesRepo {
  listPublic(input: {
    tags?: string[];
    search?: string | null;
    limit?: number;
  }): Promise<TemplateRecord[]>;
  findPublicBySlug(slug: string): Promise<TemplateRecord | null>;
  findPublicByIdOrSlug(idOrSlug: string): Promise<TemplateRecord | null>;
}

class PrismaTemplatesRepo implements TemplatesRepo {
  async listPublic(input: { tags?: string[]; search?: string | null; limit?: number }) {
    if (!hasDatabaseEnv) return [];
    const { tags = [], search = null, limit = 60 } = input;
    const where: NonNullable<Parameters<typeof prisma.template.findMany>[0]>["where"] = {
      visibility: "PUBLIC",
    };
    if (tags.length) where.tags = { hasEvery: tags };
    if (search) where.title = { contains: search, mode: "insensitive" };
    const rows = await prisma.template.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        body: true,
        fields: true,
        tags: true,
        views: true,
        copies: true,
        downloads: true,
        uses: true,
        createdAt: true,
        updatedAt: true,
        visibility: true,
      },
      take: limit,
    });
    return rows.map((r) => ({
      ...r,
      tags: normalizeTags(r.tags, { strict: false }).tags,
    }));
  }

  async findPublicBySlug(slug: string) {
    const row = await prisma.template.findFirst({
      where: { slug, visibility: "PUBLIC" },
    });
    return row ? { ...row, tags: normalizeTags(row.tags, { strict: false }).tags } : null;
  }

  async findPublicByIdOrSlug(idOrSlug: string) {
    const row = await prisma.template.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], visibility: "PUBLIC" },
    });
    return row ? { ...row, tags: normalizeTags(row.tags, { strict: false }).tags } : null;
  }
}

export function createPrismaTemplatesRepo(): TemplatesRepo {
  return new PrismaTemplatesRepo();
}
