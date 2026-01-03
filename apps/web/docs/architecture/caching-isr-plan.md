# Caching & ISR plan
Date: 2025-12-02  
Epic: markdowntown-dyq (Performance remediation wave 2)

## TTLs & tags
- Landing data (home hero lists/tags): **revalidate 60s**, tag `cache:landing`.
- Browse lists: **revalidate 60s**, tags `cache:list:all` and per-type (`cache:list:snippet|template|file`).
- Detail pages (snippet/template/file): **revalidate 300s**, tag `cache:detail:<type>:<id-or-slug>`.
- Tags clouds/spotlight: **revalidate 300s**, tag `cache:tags`.

## Invalidation
- `revalidateTag` called on section create/update/delete and document create/update/delete:
  - list tags: `cache:list:all`, `cache:list:<type>`, `cache:tags`
  - detail tag: `cache:detail:<type>:<slug-or-id>`
- Extend with votes/favorites/comments/downloads when those endpoints ship.

## Public APIs
- Cache headers: `public, s-maxage=60, stale-while-revalidate=300` (detail endpoints use 300/900).
- `Vary: Cookie`; if session cookie present -> `Cache-Control: private, no-store` (bypass for signed-in users).
- `Server-Timing: app;dur=<ms>` + `x-cache-profile` for TTFB monitoring; mirrors to `CDN-Cache-Control`.

## Pages
- `/browse` sets `revalidate = 60`.
- Snippet/Template detail set `revalidate = 300`; data pulls from cached loaders.
- Home keeps auth-aware dynamic rendering but consumes cached public data.

## Observability
- Client RUM emits `perf_navigation`, `web_vital_*`, `spa_nav`, and sampled `perf_api` with cache/serverTiming hints for cache-hit and TTFB dashboards.
- Alerts: TTFB p75 > 1200ms, cache HIT ratio < 80%, LCP p75 > 4s, INP p75 > 200ms (see docs/perf-report.md).
