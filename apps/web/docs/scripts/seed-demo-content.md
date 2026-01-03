# Seed & Backfill: Sections→Snippets
Date: 2025-12-01  
Issue: markdowntown-7z8.34

## Goals
- Provide demo/public content for landing/browse/detail during redesign.
- Backfill existing `Section` rows into `Snippet` with slugs, visibility, tags, kind, stats reset.

## Backfill steps
1) After migrations, run script:
   - For each existing Section/Snippet row:
     - slugify title; on collision, append `-<shortid>`.
     - set visibility to PRIVATE; tags empty; kind = FREEFORM.
     - stats counters zeroed.
   - Write via Prisma or SQL.
2) Seed public demo snippets/templates/documents:
   - Create seed file (JSON/TS) with curated content + tags + kind.
   - Insert with userId NULL, visibility PUBLIC.
3) Add script to `package.json` e.g. `pnpm seed:demo`.

## Data to include
- 8–12 snippets across tools/models/domains.
- 3–5 templates with placeholders + defaults.
- 2 demo documents (agents.md) assembled from seeded snippets.
- Tags covering search facets; include trending candidates.

## Safety
- Do not overwrite user content; only create or update seed rows (marked by userId NULL or seed flag).
- Idempotent: upsert by slug + userId NULL.

## Checklist
- [ ] Write seed/backfill script (ts/node) using Prisma.
- [ ] Add seed data file.
- [ ] Wire `pnpm seed:demo`; document usage.
- [ ] Run locally/staging; verify landing/browse populated.
