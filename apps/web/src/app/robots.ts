import type { MetadataRoute } from "next";
import { featureFlags } from "@/lib/flags";

export default function robots(): MetadataRoute.Robots {
  if (!featureFlags.publicLibrary) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/"],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: ["/api", "/signin", "/api/auth", "/browse", "/builder"],
    },
    sitemap: "https://markdown.town/sitemap.xml",
  };
}
