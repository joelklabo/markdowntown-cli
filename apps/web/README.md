# mark downtown
Scan instruction files in a repo, understand how tools load them, and export a clean agents.md from the Workbench.

## What’s here
- Atlas Simulator to scan a folder and preview which instruction files load (and in what order).
- Workbench to assemble scopes + blocks, then preview/lint/export agents.md.
- Library of public artifacts with “Open in Workbench” as the primary action.
- Translate helpers for converting instruction formats across tools.
- App Router Next.js 16 + Tailwind v4 UI with Prisma + NextAuth.
- RESTful section APIs (`/api/sections`) protected by session auth.
- GitHub login via NextAuth (database sessions) and a health check at `/api/health`.
- Dockerfile, GitHub Actions CI (lint, type-check, build), Beads backlog.
- Design system: mark downtown brand icon, Tailwind tokens, global utilities, and UI primitives (BrandLogo, Button, Card, Pill).
- Release docs: Semantic Versioning, CHANGELOG, and migration/release guides in `docs/`.
- CDN-friendly asset headers; ACA scaling set to min=1, max=5; HTTP scale rule concurrentRequests=50.
- Open Graph image: `public/og-image-base.svg` registered in Next metadata.

## Quick start
```bash
pnpm install
cp .env.example .env.local          # add GitHub OAuth + NEXTAUTH_SECRET
pnpm prisma generate
pnpm prisma migrate dev --name init # seeds the local sqlite db
pnpm dev
```
Open http://localhost:3000 and sign in with GitHub to access the composer.
Labs: http://localhost:3000/labs/city-logo

Primary flow: http://localhost:3000/atlas/simulator → http://localhost:3000/workbench

## Scripts
- `pnpm dev` – run locally
- `pnpm lint` – ESLint (max warnings=0) + style guards
- `pnpm lint:knip` – unused deps/exports
- `pnpm lint:cycles` – circular dependency check
- `pnpm type-check` – TypeScript without emit
- `pnpm test` – Vitest (jsdom + node envs)
- `pnpm build` – production build
- Tooling workspace: `pnpm -C tools lint|type-check|unit|e2e|lighthouse|bundle`

## Docker
```bash
docker build -t markdowntown .
docker run -p 3000:3000 \
  -e DATABASE_URL="file:./dev.db" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET=dev \
  -e GITHUB_CLIENT_ID=placeholder \
  -e GITHUB_CLIENT_SECRET=placeholder \
  markdowntown
```

## Deployment (Azure Container Apps outline)
1. Build and push image to ACR or GHCR.
2. `az containerapp create ... --image <registry>/markdowntown:TAG --target-port 3000 --ingress external --min-replicas 1`
3. Configure secrets/env: `DATABASE_URL`, `GITHUB_CLIENT_ID/SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, PostHog/Sentry when added.
4. Add custom domain + cert (see checklist in the issue description).

## Beads workflow
- Issues live in `.beads`. `bd list` to view; tasks are grouped under epics (Application Core, Auth, Composer, DevOps, etc.).
- Create work under an epic: `bd create --parent <epic-id> "Implement X"`.
- Commit `.beads` changes with code for traceability.

## More docs
- User guide: `docs/USER_GUIDE.md`
- Developer onboarding: `docs/DEV_ONBOARDING.md`
- Release process: `docs/RELEASE_PROCESS.md`
- Migration policy: `docs/MIGRATIONS.md`
- Monitoring/analytics: set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, and optional `NEXT_PUBLIC_POSTHOG_HOST`.
- Beads CLI quick reference: `docs/BEADS.md`
- E2E workflow (conditional): set secrets `GITHUB_CLIENT_ID_TEST`, `GITHUB_CLIENT_SECRET_TEST`, `GITHUB_TEST_USER`, `GITHUB_TEST_PASS` to enable GitHub OAuth Playwright runs on CI
- Architecture overview: `docs/architecture/architecture.md`
- Caching/ISR plan: `docs/architecture/caching-isr-plan.md`
- Runbooks: `docs/runbooks/perf.md`, `docs/runbooks/deploy-rollback.md`, `docs/runbooks/env-setup.md`
- Security posture: `docs/security.md`
