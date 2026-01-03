# Architecture

## Runtime
- Next.js 16 App Router (Node runtime) with Turbopack for dev; Webpack for prod builds.
- UI: Tailwind v4 tokens + custom components; client-only islands (builder, composer) loaded via dynamic imports.
- Auth: NextAuth GitHub provider (database sessions) stored in Postgres/SQLite.
- Observability: Sentry (errors), PostHog (RUM + product events), Server-Timing headers with trace IDs.

## Data flow
- API routes under `/api` call repository interfaces (`services/`) which wrap Prisma.
- Public read surfaces use `listPublic*` helpers with cached/ISR responses; private CRUD uses session-authenticated endpoints.
- Database: `Snippet` (sections), `Template`, `Document`, `User`, `Session/Account` tables (see `prisma/schema.prisma`).

## Caching & ISR
- Public pages and APIs use `cacheHeaders` profiles (landing/browse/detail) with `s-maxage` + `stale-while-revalidate`.
- Data loaders are wrapped in `unstable_cache` with tag-based invalidation (`cacheTags`), revalidated on create/update/delete.
- See `docs/architecture/caching-isr-plan.md` for TTLs, tags, and invalidation rules.

## Feature flags
- Flags (from release plan): `public_library`, `builder_v2`, `templates_v1`, `engagement_v1`.
- Store flags in env or PostHog feature flags; gate surfacing of public library, builder UI, and engagement actions.

## Observability & APM
- `withAPM` adds `x-trace-id` and `Server-Timing: total` to public APIs; per-route timing adds `app` + `cache` hints.
- PerfVitals emits RUM metrics (TTFB/LCP/CLS/INP/FCP) + SPA nav + sampled API timings.
- Dashboards and budgets documented in `docs/perf-report.md`.
