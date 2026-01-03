# Public Read API Plan
Date: 2025-12-01
Epic: markdowntown-7z8

## Goals
- Allow anonymous clients to list and view public Snippets, Templates, and Documents (agents.md files).
- Keep private/unlisted content hidden; prevent accidental leakage of user-owned drafts.
- Support discovery: filters (tags/type/model), sorts (trending/new/top/copied), pagination, and lightweight stats.
- Be cache-friendly (ISR/HTTP cache) and abuse-resistant (rate limiting on writes only; reads open but monitored).

## Endpoints (App Router)
- `GET /api/public/snippets` – list with query params: `page`, `limit`, `tags`, `type/kind`, `sort` (trending|new|top|copied), `q` (search term).
- `GET /api/public/snippets/[slug]` – detail; returns rendered markdown, raw, stats, tags, related IDs.
- `GET /api/public/templates` / `GET /api/public/templates/[slug]` – include placeholder schema.
- `GET /api/public/documents` / `GET /api/public/documents/[slug]` – include ordered snippet refs and rendered snapshot.
- `GET /api/public/tags` – top tags with counts, trending tags windowed by 7/30 days.
- `GET /api/public/search` – unified search across types; returns typed hits.

## Data/visibility rules
- Only `visibility = public` returned. `unlisted` accessible by slug/id if user owns or shares a signed token (future). Private never exposed.
- Filter out soft-deleted/flagged items and draft templates (fields like `isDraft` if added).
- Stats exposed are pre-aggregated counters (views/copies/downloads/votes); write events go to an Event table.

## Sorting/ranking
- `trending`: time-decayed score using copies, views, votes in last 7 days.
- `top`: votes + copies lifetime.
- `copied`: copies descending.
- `new`: createdAt desc.

## Caching/ISR
- Pages: landing, browse, detail use ISR with revalidate=60 (list) / 300 (detail) initially; revalidate on write events.
- API: set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for lists; 300/900 for detail.
- Consider CDN caching for GET routes; bypass cache on auth-only actions.

## Pagination
- Cursor-based pagination (id/createdAt) for lists/search; default limit 20, max 50.

## Abuse/safety
- No auth required for GET; rely on model visibility + content sanitization.
- Rate limits remain on POST/PUT/DELETE/vote/comment endpoints, not on public reads.
- Ensure markdown is sanitized server-side (consistent with render pipeline) before returning rendered HTML if we include it; raw markdown is returned as text/plain fields.

## Migration path
- Add `visibility`, `slug`, `tags` to Snippet (rename from Section) + new Template/Document models.
- Backfill slugs and set existing rows to `private` by default.
- Feature flag `public_library`: keep current public API narrowed to `userId=null` until backfill completes.

## Implementation checklist
- [ ] Wire Prisma models/migrations (Snippet visibility/tags/slug, Template, Document) per migrations docs.
- [ ] Add App Router handlers for list/detail across Snippet/Template/Document with cursor pagination and filters.
- [ ] Apply cache headers + `Vary: Cookie` only when responses differ for authed overlays.
- [ ] Return sanitized rendered HTML plus raw markdown; block private/unlisted by default.
- [ ] Tag-based revalidation on create/update/delete and engagement writes.
- [ ] E2E/regression tests: list filters/sorts, detail access control (public vs private), cache header assertions.
