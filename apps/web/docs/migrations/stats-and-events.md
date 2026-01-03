# Stats & Events Plan (views, copies, downloads, template uses)
Date: 2025-12-01  
Issue: markdowntown-7z8.16

## Goals
- Track key engagement events and expose lightweight counters on Snippets/Templates/Documents without harming read performance.
- Support trending calculations and abuse monitoring.

## Data model
- **Event** table: `id`, `userId?`, `targetType (snippet|template|document)`, `targetId`, `kind (view|copy|download|template_use|builder_export)`, `metadata` (ip, ua, referrer), `createdAt`.
- Entity counters (columns already planned): `views`, `copies`, `downloads`, `uses`, `favoritesCount`, `commentsCount`, `votesUp`, `votesDown`.
- Materialized views (per type) for trending scores (e.g., last 7/30 days).

## Ingestion
- Server-side logging on read endpoints and actions:
  - Detail page/API GET → `view`
  - Copy/download buttons → `copy`/`download`
  - Template fill/export → `template_use`
  - Builder export → `builder_export`
- Capture `userId` when available; otherwise null + IP/UA for rate analysis.
- Debounce views per session/device (e.g., 1 per 30m per target).

## Rollup
- Cron/worker job (hourly/daily): aggregate events into entity counters.
  - `views += count(*) where kind='view'`
  - `copies += count(*) where kind='copy'` etc.
  - Upsert into counters; optionally store lastRefreshed.
- Refresh trending materialized views after rollup.

## APIs
- Public GET responses include counters; avoid returning raw events.
- Optional `GET /api/public/trending?type=snippet|template|document` uses MV.
- Admin/debug: rate-limit logs and high-volume IPs (separate admin endpoint).

## Caching
- Counters on entities allow cached responses without joining events.
- Revalidate tags (`snippet:<slug>`, `template:<slug>`, `document:<slug>`) after rollup or on significant writes.
- Edge cache list feeds with short TTL (60s) since counters change often.

## Safety & abuse
- Rate limit event creation to prevent spam (especially copy/download).
- Discard events with missing target; validate target visibility before logging.
- Ensure metadata is bounded (truncate UA/referrer).

## Testing
- Unit: event logging helpers, debounce logic.
- Integration: rollup job updates counters correctly; MV refresh executes.
