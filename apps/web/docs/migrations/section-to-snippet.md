# Migration Plan: Section → Snippet (visibility, tags, slug, stats)
Date: 2025-12-01  
Issue: markdowntown-7z8.12

## Scope
- Rename `Section` model/table to `Snippet`.
- Add fields: `slug`, `visibility` (PUBLIC|UNLISTED|PRIVATE), `tags` (string[]), `kind` (System/Style/Tools/Freeform), stats counters (`views`, `copies`, `downloads`, `votesUp`, `votesDown`, `favoritesCount`, `commentsCount`).
- Keep backwards compatibility for `/api/sections` until frontend/API swaps to `snippet`.

## Steps
1) **Prisma schema update**
   - Rename model `Section` → `Snippet`.
   - Add enums `Visibility`, `SnippetKind`.
   - Add fields above; indexes on `userId`, `visibility`, `createdAt`, `updatedAt`.
   - Regenerate client: `pnpm prisma generate`.
2) **Database migration (SQL outline)**
   - `ALTER TABLE "Section" RENAME TO "Snippet";`
   - `ALTER TABLE "Snippet" ADD COLUMN slug TEXT UNIQUE;`
   - `ALTER TABLE "Snippet" ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE';`
   - `ALTER TABLE "Snippet" ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';`
   - `ALTER TABLE "Snippet" ADD COLUMN kind TEXT NOT NULL DEFAULT 'FREEFORM';`
   - `ALTER TABLE "Snippet" ADD COLUMN views INT NOT NULL DEFAULT 0;` (repeat for copies, downloads, votesUp, votesDown, favoritesCount, commentsCount).
   - Add indexes: `(userId)`, `(visibility)`, `(createdAt)`, `(updatedAt)`.
3) **Backfill**
   - Populate `slug` via parameterized update: slugify(title) with tie-breaker on collisions (`-2`, `-3`, …).
   - Set `visibility='PRIVATE'` for all existing rows.
   - Set `kind='FREEFORM'` for all rows.
   - Optional: seed a handful of public snippets once reviewed.
4) **App compatibility**
   - Update app imports from `prisma.section` to `prisma.snippet` (routes, cache, tests already aligned).
   - Keep `/api/sections` routing but backed by `Snippet`; mark deprecated.
   - When ready, alias `/api/snippets` and add public read endpoints behind `public_library` flag.
5) **Feature flag & rollout**
   - Gate public exposure with `public_library`; default closed.
   - After backfill + tests, switch frontend calls to `snippet` terminology; remove old `Section` references.
6) **Testing**
   - Run `pnpm test` and add migration smoke: create, list, update, delete via `/api/sections`.
   - Add unit for slug generation collision handling.

## Risks / mitigations
- **Slug collisions**: use deterministic suffixing; enforce unique index.
- **Cache/stats drift**: revalidate tags after rename; ensure counters default 0.
- **Backward compatibility**: keep `/api/sections` until clients are swapped; document sunset date.
