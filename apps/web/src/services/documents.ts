import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { normalizeTags } from "@/lib/tags";

export type DocumentRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  renderedContent: string | null;
  tags: string[];
  views: number;
  copies: number;
  createdAt: Date;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
};

export interface DocumentsRepo {
  listPublic(input: {
    tags?: string[];
    search?: string | null;
    limit?: number;
  }): Promise<DocumentRecord[]>;
  findPublicBySlug(slug: string): Promise<DocumentRecord | null>;
}

class PrismaDocumentsRepo implements DocumentsRepo {
  async listPublic(input: { tags?: string[]; search?: string | null; limit?: number }) {
    if (!hasDatabaseEnv) return [];
    const { tags = [], search = null, limit = 60 } = input;
    const where: NonNullable<Parameters<typeof prisma.document.findMany>[0]>["where"] = { visibility: "PUBLIC" };
    if (tags.length) where.tags = { hasEvery: tags };
    if (search) where.title = { contains: search, mode: "insensitive" };
    const rows = await prisma.document.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        renderedContent: true,
        tags: true,
        views: true,
        copies: true,
        createdAt: true,
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
    const row = await prisma.document.findFirst({
      where: { slug, visibility: "PUBLIC" },
    });
    return row ? { ...row, tags: normalizeTags(row.tags, { strict: false }).tags } : null;
  }
}

export function createPrismaDocumentsRepo(): DocumentsRepo {
  return new PrismaDocumentsRepo();
}
