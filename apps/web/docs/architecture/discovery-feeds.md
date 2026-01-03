# Discovery Feeds (Trending/New/Top/Most-copied, Tag Spotlight)
Date: 2025-12-01  
Issue: markdowntown-7z8.23

## Goals
- Serve precomputed feeds for landing/browse: trending, new, top, most-copied, and tag spotlight.
- Keep responses cacheable and fast under anonymous-heavy traffic.

## Feeds
- `GET /api/public/trending?type=snippet|template|document&limit=12`
- `GET /api/public/top?type=...`
- `GET /api/public/most-copied?type=...`
- `GET /api/public/new?type=...`
- `GET /api/public/tags/spotlight?limit=20` (top tags by recent activity)

## Data sources
- Materialized views per type: `*_trending_mv` (score + counters in last 7/30d).
- Simple queries for top/most-copied/new using entity counters and timestamps.
- Tag spotlight: `unnest(tags)` grouped + recent window weighting.

## Caching
- API headers: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- Tag responses cache 5 minutes; tag spotlight cached 10 minutes.
- Revalidate tags on write events and rollup refresh.

## Ranking formulas
- Trending: use score from search-and-ranking plan (copies/votes/views + decay).
- Top: votes + copies lifetime.
- Most-copied: copies desc.
- New: createdAt desc (visibility=PUBLIC).

## Validation/safety
- Only return `visibility=PUBLIC`; exclude flagged/soft-deleted items.
- Limit `limit` (max 50); enforce cursor/offset bounds.

## Testing checklist
- Feeds respect visibility and limit bounds.
- Trending uses MV data; refresh fallback if MV missing.
- Tag spotlight returns expected ordering for recent high-activity tags.

## References
- docs/architecture/search-and-ranking.md
- docs/research/search-ranking-tag-clouds.md
