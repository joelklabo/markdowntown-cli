# Release Process

This project follows Semantic Versioning (MAJOR.MINOR.PATCH).

## Versioning
- Start at v0.1.0 (current). Increment:
  - PATCH for fixes/internal changes.
  - MINOR for backwards-compatible features.
  - MAJOR for breaking changes (API/schema).
- Tag releases as `vX.Y.Z` and push tags to GitHub.

## Changelog
- Maintain `CHANGELOG.md` in Keep-a-Changelog format.
- Each release gets an entry under its version/date; unreleased changes live under `## [Unreleased]`.

## Cutting a release
1) Ensure main is green in CI.
2) Update `CHANGELOG.md` (move Unreleased to new version, add date).
3) Bump `package.json` version if appropriate.
4) Commit: `git commit -am "chore: release vX.Y.Z"`.
5) Tag: `git tag vX.Y.Z && git push origin main --tags`.
6) CD workflow builds and updates Azure Container App using the tag SHA. It pulls secrets from GitHub/Azure.

### Feature-flagged UI rollouts
- `NEXT_PUBLIC_THEME_REFRESH_V1` gates the sitewide visual refresh. Default is `false`.
- Enable in staging first, capture visual baselines, then roll to production once approved.

## Database migrations
- Add schema changes with Prisma migrate: `pnpm prisma migrate dev --name <change>`.
- Commit the migration files under `prisma/migrations`.
- For prod deploys, migrations run via the separate `markdowntown-migrate` job (kick with `az containerapp job start -n markdowntown-migrate -g satoshis-stg-west-rg`).
- For zero-downtime, avoid destructive changes in a single deploy; add columns first, backfill via script, then remove old fields in a later release.

## Rollback
- Redeploy previous image tag via Azure CLI:
  `az containerapp update -g satoshis-stg-west-rg -n markdowntown-app --image satoshiswestacr.azurecr.io/markdowntown:<old-tag>`.
- If a migration broke prod data, restore Postgres to a point-in-time snapshot (Azure Flexible Server) or to a dump if taken pre-release, then redeploy the previous image.

## Post-release
- Monitor Sentry/PostHog (when enabled) and ACA logs.
- If schema changed, ensure migrate job succeeded; re-run if needed.
- Purge Cloudflare cache if static assets were affected.
