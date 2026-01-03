# SEO, OG, and Sitemap Plan for Public Library
Date: 2025-12-01
Epic: markdowntown-7z8

## Objectives
- Make public snippets/templates/documents discoverable once the library is live.
- Provide rich previews (OG/Twitter) for detail pages and landing/browse.
- Keep private/unlisted content out of indexing.

## Meta strategy
- Dynamic metadata per page (Next.js Metadata API):
  - title: "{item.title} | mark downtown"
  - description: first 150-200 chars of content/description.
  - og:image: generated OG card with title + type + tags.
  - canonical: `https://markdown.town/{type}/{slug}`
  - robots: `index, follow` only if visibility=PUBLIC; otherwise `noindex, nofollow`.
- Add JSON-LD:
  - BreadcrumbList for detail pages.
  - ItemList for feed pages (landing/browse/templates/tags) with top items.

## OG image generation
- Implement `/api/og/{type}/{slug}` route using @vercel/og or satori to render card: title, type badge, tags, copies/votes.
- Cache OG responses (revalidate 1 day); invalidate on update.

## Sitemap
- `/sitemap.xml` generated server-side with public slugs only:
  - `/`, `/browse`, `/templates`, `/tags`
  - `/snippets/{slug}`, `/templates/{slug}`, `/files/{slug}` for visibility=PUBLIC
  - Changefreq weekly; lastmod from updatedAt.
- Keep behind `public_library` flag until launch.

## Robots
- `/robots.txt` allow all; disallow draft feature flags; once live, allow public paths.
- While flag OFF in prod, serve `Disallow: /` to avoid premature indexing.

## Implementation steps
1) Add slug fields to routes and APIs (already in schema); ensure detail pages fetch by slug.
2) Add metadata generation to detail pages using item data and OG URLs.
3) Build OG image endpoint and wire into metadata.
4) Create sitemap route that queries public slugs; cache for 24h.
5) Toggle robots/sitemap exposure with feature flag `public_library`.

## Analytics
- Track share clicks, copy link events, and inbound referrers from organic search once live.
