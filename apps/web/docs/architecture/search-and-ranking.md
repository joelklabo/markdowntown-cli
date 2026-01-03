# Search & Ranking Plan
Date: 2025-12-01
Epic: markdowntown-7z8

## Goals
- Fast discovery across Snippets, Templates, Documents with filters and sorts: Trending, New, Most copied, Top rated.
- Keep infra simple (stay in Postgres) but allow future upgrade to external search if needed.
- Align search API implementation tasks (markdowntown-7z8.19) with research doc `docs/research/search-ranking-tag-clouds.md`.

## Approach (Postgres-first)
- **FTS**: use `to_tsvector('english', title || ' ' || coalesce(content/description,''))` on Snippet/Template/Document. Create GIN indexes on tsvector fields.
- **Trigram**: optional pg_trgm for fuzzy match on title/slug; can boost short queries.
- **Ranking**: combine term rank + popularity score.

### Ranking formula (Trending)
```text
score = 0.5*log1p(copies) + 0.25*log1p(votesUp - votesDown) + 0.15*log1p(views) + 0.1*freshness
freshness = max(0, 14 - days_since_updated) / 14
```
- Compute daily in a materialized view per type.

### Top / Most copied / New
- Top: order by (votesUp - votesDown) desc, copies desc, updatedAt desc.
- Most copied: copies desc (tie-break updatedAt desc).
- New: createdAt desc.

## Data structures
- Add materialized views:
  - `snippet_trending_mv`, `template_trending_mv`, `document_trending_mv` with columns: id, score, copies, votes, views, updatedAt.
- Cron job (daily) to refresh MVs; optionally `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

## API contracts
- `GET /api/public/search?q=&type=&tags=&sort=&page=`
  - `sort`: relevance (default when q present), trending, new, copied, top
  - `type`: snippet|template|document|all
  - `tags`: csv list; filter where tags @> array
- `GET /api/public/trending?type=snippet&limit=12`
- `GET /api/public/tags` returns { tag, count, recentCount }

## Implementation steps
1) Add tsvector columns (generated) + GIN index per table. Example:
   `tsv_title_content GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))) STORED`
2) Add trigram index on title for fuzzy search (optional, behind feature flag).
3) Create MVs for trending per type; add SQL script + cron (Supabase/PG cron or app-scheduled job).
4) Implement search endpoint using `plpgsql` functions or Prisma raw queries; paginate with cursor.
5) Hook browse page to search/sort params; default to trending feed endpoints when no query.
6) Cache empty-query + sort combos for 60s; term queries `no-store`.

## Perf notes
- Limit page size to 50; keep responses <200ms by using precomputed scores and covering indexes.
- Cache search results for short TTL (e.g., 30s) for empty query + sort combos.

## Risks
- PG FTS ranking can be noisy for very short content; may need boosting weights or switching to trigram for q < 3 chars.
- MV refresh lag; score may be slightly stale—acceptable for browse feeds.
- Copies/votes stored as counters; ensure rollup jobs keep stats consistent with events.
