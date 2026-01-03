# Environment setup runbook

## Local
1) `pnpm install`
2) `cp .env.example .env.local` and set:
   - `DATABASE_URL="file:./dev.db"`
   - `NEXTAUTH_SECRET` (any random string for dev)
   - `GITHUB_CLIENT_ID/SECRET` (optional for local auth)
   - `NEXT_PUBLIC_POSTHOG_KEY` (optional)
   - `WATCHPACK_POLLING=true` and `WATCHPACK_POLLING_INTERVAL=1000` if you see `EMFILE` or HMR/hydration stalls in local dev
3) `pnpm prisma migrate dev --name init`
4) `pnpm dev`

## Staging / Production
- Required: `DATABASE_URL` (Postgres), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_CLIENT_ID/SECRET`
- Observability: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Feature flags: set defaults for `public_library`, `builder_v2`, `templates_v1`, `engagement_v1`, `NEXT_PUBLIC_SCAN_QUICK_UPLOAD_V1`.
- Verify health: `/api/health` returns `{status:"ok"}`.

## Troubleshooting
- Prisma schema mismatch: run `pnpm prisma migrate deploy` (prod) or `pnpm prisma generate` (local).
- Auth failures: ensure `NEXTAUTH_URL` matches public URL and GitHub OAuth callback.
- Missing static assets: check CDN cache headers and `next.config.ts` header rules.
