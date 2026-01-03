# Migration plan: public Snippet/Template/Document models
Date: 2025-12-01

## Objectives
- Rename Section → Snippet and add visibility/tags/slug/stats.
- Add Template (with fields schema) and Document (agents.md file) + ordered join table.
- Prepare for public read endpoints while keeping existing owner-only behavior during rollout.

## Steps (Prisma / Postgres)
1) **Create new enums & tables**
   - Enum `Visibility` = PUBLIC | UNLISTED | PRIVATE
   - Enum `SnippetKind` = SYSTEM | STYLE | TOOLS | FREEFORM
   - Table `Template`: id, slug (unique), title, description, body (text), fields (jsonb), visibility, tags (text[]), stats counters, userId FK, timestamps.
   - Table `Document`: id, slug (unique), title, description, visibility, tags (text[]), renderedContent (text), userId FK, timestamps.
   - Table `DocumentSnippet`: documentId, snippetId, position (int), overrides (jsonb), PK (documentId, position), indexes on snippetId.
   - Tables `Vote`, `Favorite`, `Comment`, `Event` (per earlier data-model doc) with targetType/targetId.

2) **Alter existing Section → Snippet**
   - Rename table `Section` to `Snippet`.
   - Add columns: slug (text, unique), visibility (Visibility, default PRIVATE), tags (text[]), kind (SnippetKind, default FREEFORM), stats counters (views, copies, downloads, votesUp, votesDown, favoritesCount, commentsCount default 0).
   - Add indexes on slug, visibility, createdAt, updatedAt, tags (gin).

3) **Backfill**
   - Generate slugs from title (slugify + cuid suffix on collision).
   - Set visibility=PRIVATE for all existing records; optionally PUBLIC for seed/userId null rows.
   - Set kind=FREEFORM default.

4) **Code compatibility**
   - Update Prisma client and TypeScript types.
   - Keep legacy `/api/sections` working by mapping to Snippet where userId matches session (no visibility change).
   - Add public read APIs to filter visibility=PUBLIC.

5) **Rollout**
   - Feature flag `public_library` guards new public pages and APIs.
   - Dual-write: none needed for rename after migration; ensure client code updated.
   - Smoke tests: list public snippets, create/save snippet as authed user, ensure private not exposed.

6) **Follow-ups**
   - Add computed trending materialized view or background job for ranking.
   - Add search index (PG trigram/FTS) across title/content/tags.

