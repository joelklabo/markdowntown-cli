# Tag Cloud API & UI
Date: 2025-12-01  
Issue: markdowntown-7z8.49

## API
- `GET /api/public/tags`
  - params: `window=7d|30d|all` (optional), `limit` (default 50, max 100).
  - returns: `{ tag: string, count: number, recentCount?: number }[]`
- `GET /api/public/tags/spotlight`
  - returns top tags by recent activity (copies/views/votes) with decay.

## Query (Postgres)
```sql
SELECT tag, COUNT(*) AS count
FROM (
  SELECT unnest(tags) AS tag, updated_at
  FROM snippets WHERE visibility='PUBLIC'
  UNION ALL
  SELECT unnest(tags), updated_at FROM templates WHERE visibility='PUBLIC'
  UNION ALL
  SELECT unnest(tags), updated_at FROM documents WHERE visibility='PUBLIC'
) t
WHERE updated_at > NOW() - INTERVAL '7 days' -- window param
GROUP BY tag
ORDER BY count DESC
LIMIT 50;
```
- Add trigram/lowercasing; store tags normalized to lowercase on write.

## Caching
- `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`.
- Tag spotlight cache 10 minutes. Revalidate on write or rollup refresh.

## UI
- Landing tag cloud module (click → /browse?tags=tag).
- Browse filters: tag pills/multi-select fed by API.
- Detail related tags link back to filtered browse.

## Checklist
- [ ] API routes with window/limit validation; visibility filter.
- [ ] Normalize tags to lowercase on save; trim length.
- [ ] Cache headers + revalidate on write events.
- [ ] UI components consume API; graceful empty state.
- [ ] Analytics: track tag pill clicks.
- [ ] Tests for API (counts, window filter, limit).
