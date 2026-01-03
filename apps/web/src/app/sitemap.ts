import type { MetadataRoute } from "next";
import { featureFlags } from "@/lib/flags";
import { listPublicItems } from "@/lib/publicItems";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!featureFlags.publicLibrary) {
    // Return minimal sitemap to avoid indexing while flagged off.
    return [];
  }

  const baseUrl = "https://markdown.town";
  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/atlas/simulator`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/library`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/translate`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/docs`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/tags`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/changelog`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const items = await listPublicItems({ limit: 500, type: "all", sort: "recent" });
  const itemPaths: MetadataRoute.Sitemap = items.map((item) => {
    const typePath =
      item.type === "template" ? "templates"
        : item.type === "file" ? "files"
          : item.type === "agent" ? "a"
            : "snippets";
    const slug = item.slug ?? item.id;
    return {
      url: `${baseUrl}/${typePath}/${slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    };
  });

  return [...staticPaths, ...itemPaths];
}
