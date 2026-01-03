# Data Model: Snippets, Templates, Documents (agents.md)
Date: 2025-12-01
Epic: markdowntown-7z8

## Entities
- **User** (existing)
- **Snippet** (rename from Section)
  - id (cuid), slug (unique, derived from title), title, content, kind (system|style|tools|freeform), visibility (public|unlisted|private), tags (string[]), stats: views, copies, downloads, votesUp, votesDown, favoritesCount, commentsCount, order (for user-owned lists), userId (nullable for seed/public), agentId? (future), createdAt, updatedAt
- **Template**
  - id, slug, title, description, body (markdown with placeholders), fields (json schema: name, type, default, required, description, validation), visibility, tags, stats (views, copies, downloads, uses), userId, createdAt, updatedAt
- **Document (AgentsFile)**
  - id, slug, title, description, visibility, tags, renderedContent (snapshot), userId, createdAt, updatedAt
- **DocumentSnippet** (join, ordered)
  - documentId, snippetId, position, overrides (optional content overrides per snippet)
- **Vote**
  - id, userId, targetType (snippet|template|document), targetId, value (+1/-1), createdAt
- **Favorite**
  - id, userId, targetType (snippet|template|document), targetId, createdAt
- **Comment**
  - id, userId, targetType, targetId, body, createdAt, updatedAt, visibility/moderation fields
- **Event** (for stats rollups)
  - id, userId?, targetType, targetId, kind (view|copy|download|template_use|builder_export), metadata (ip, ua), createdAt
- **Tag** (optional normalization)
  - id, name (unique, lowercased), createdAt; many-to-many to Snippet/Template/Document if we normalize tags instead of string[]

## Migrations outline
1) Rename `Section` → `Snippet` table and update Prisma model; add slug, visibility, tags (string[]), kind, stats counters.
2) Backfill slugs from titles; set visibility=private for existing rows; kind=freeform default.
3) Add `Template` table (fields as jsonb), `Document` table, `DocumentSnippet` join for ordering/overrides.
4) Add `Vote`, `Favorite`, `Comment`, `Event` tables with indexes by targetType/targetId and userId.
5) Add materialized views or rollup cron to aggregate stats into the entity counters; triggers or periodic jobs to keep counters fresh.
6) Add unique indexes: snippet.slug (where visibility=public or userId scope), template.slug, document.slug.

## API impact
- Public GET endpoints for Snippet/Template/Document lists and detail; filter by visibility=public.
- Auth-only POST/PUT/DELETE for creates/updates/deletes; auth-only vote/favorite/comment endpoints.
- Builder/export endpoint accepts snippet IDs + ordering and optional template field values; returns rendered markdown and file name; supports anon (no save) and authed (save Document + events).

## Caching/ISR considerations
- List endpoints paginated with cache headers; revalidate on write events.
- Detail pages eligible for ISR; revalidate on update or stat rollup if counters displayed.

## Backfill/compatibility
- Keep legacy `/api/sections` temporarily reading from Snippet with view limited to owner; mark deprecated.
- Add a migration script to generate slugs and default visibility; seed public library content.
