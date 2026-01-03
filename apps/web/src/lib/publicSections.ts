import { unstable_cache } from "next/cache";
import { cacheTags } from "./cacheTags";
import { getServices } from "@/services";

export type PublicSection = {
  id: string;
  slug?: string | null;
  title: string;
  content: string;
  tags: string[];
  updatedAt: Date;
  createdAt: Date;
};

const isTestEnv = process.env.NODE_ENV === "test";

export async function listPublicSections(limit = 24): Promise<PublicSection[]> {
  const { sections: sectionsRepo } = getServices();
  if (isTestEnv) return sectionsRepo.listPublic({ limit });
  const cached = unstable_cache(
    (nextLimit: number) => sectionsRepo.listPublic({ limit: nextLimit }),
    ["public-sections"],
    { revalidate: 60, tags: [cacheTags.list("all"), cacheTags.list("snippet"), cacheTags.landing] }
  );
  return cached(limit);
}

export async function getPublicSection(idOrSlug: string): Promise<PublicSection | null> {
  const { sections: sectionsRepo } = getServices();
  if (isTestEnv) return sectionsRepo.findByIdOrSlug(idOrSlug);
  const detailCache = unstable_cache(
    () => sectionsRepo.findByIdOrSlug(idOrSlug),
    ["public-section", idOrSlug],
    { revalidate: 300, tags: [cacheTags.detail("snippet", idOrSlug), cacheTags.list("snippet")] }
  );
  return detailCache();
}
