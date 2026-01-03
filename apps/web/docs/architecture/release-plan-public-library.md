# Release & Migration Plan: Public Library + agents.md Builder
Date: 2025-12-01
Epic: markdowntown-7z8
Owner: devops/product

## Feature flags
- `public_library` – enables public browse/detail pages and public read APIs.
- `builder_v2` – enables new builder UI/workflow.
- `templates_v1` – enables Template model/routes and template fill UI.
- `engagement_v1` – enables votes/favorites/comments APIs and UI affordances.

## Staged rollout
1) **Schema & data (internal only)**
   - Apply Prisma migration (Snippet rename, visibility, tags, slugs, Template/Document, joins).
   - Backfill slugs; set all existing items to `PRIVATE`; set seed items (userId NULL) to `PUBLIC`.
   - Keep `public_library` OFF; public APIs return empty/seed only.
2) **Backend read stack**
   - Implement public GET APIs for Snippet/Template/Document with visibility filter + caching.
   - Add search/trending endpoints (with low TTL caches) but keep flag OFF.
3) **Frontend surfacing (internal)**
   - Enable `public_library` only for internal/staging; verify landing/browse/detail pull live data.
   - SEO/OG/sitemap generation gated by flag to avoid indexing while private.
4) **Engagement + auth gating**
   - Ship votes/favorites/comments behind `engagement_v1`; add rate limits.
   - Inline login prompts; verify callback resumes action.
5) **Gradual exposure**
   - Turn on `public_library` for a small % of traffic or only for anonymous users first.
   - Monitor error rates, TTFB, and cache hit ratio; roll back flag if elevated errors/latency.
6) **Full launch**
   - Enable `public_library`, `builder_v2`, `templates_v1` globally.
   - Announce; remove seed-only restrictions; allow indexing (update robots/sitemap).

## Migration steps
- Ensure `DATABASE_URL` points to Postgres; take snapshot/backup.
- Run: `pnpm prisma migrate dev --name public_models` (or `migrate deploy` in CI/prod).
- Backfill slugs: slugify title + short id suffix for collision avoidance.
- Backfill visibility: existing rows -> PRIVATE; seed/public seed rows (userId NULL) -> PUBLIC.
- Verify dual-read: `/api/sections` (owner-only) still works via Snippet table.
- Update environment flags default OFF in prod.

## Rollback
- If migration fails: restore DB snapshot; redeploy previous Prisma client.
- If public flag causes issues: disable `public_library` and `builder_v2`; public pages return 404/redirect; APIs can return 404 while private flows remain.
- Keep `robots.txt` disallow `/` during rollback to avoid index churn.

## Monitoring & checks
- Dashboards: error rate (4xx/5xx) on public endpoints; latency p75; cache hit rate; copy/download/favorite events.
- Alerts: spike in `engagement_v1` endpoints; unusual copy/download volume; increased DB CPU from public reads.
- Security: ensure rendered markdown sanitization; CSP headers intact; rate limits on write paths.

## Open tasks before launch
- Finish search/trending ranking and caching strategy.
- Wire builder/templates to live data and slugs.
- Add sitemap/OG with visibility filter.
- Add abuse-reporting/logging on public endpoints.
