# Database Migration Policy

- Tooling: Prisma migrate.
- Default dev DB: SQLite (`file:./dev.db`). Prod: Azure PostgreSQL.

## Adding a migration
```bash
pnpm prisma migrate dev --name <change>
pnpm prisma generate
```
Commit the generated folder under `prisma/migrations`.

## Applying in production
- The `markdowntown-migrate` Container App job runs `pnpm prisma migrate deploy` against prod Postgres.
- Trigger it after deploy: `az containerapp job start -g satoshis-stg-west-rg -n markdowntown-migrate`.

## Safe changes
- Prefer additive changes (new tables/columns, indexes).
- For breaking changes, do a two-step deploy: add new column + write both fields, backfill, then drop old column in a later release.

## Backups
- Rely on Azure Flexible Server PITR (currently 7+ days retention); take a manual dump before risky migrations if possible.

## Local tips
- Reset dev DB: `pnpm prisma migrate reset` (will wipe data).
- Use `pnpm prisma studio` for inspecting data locally.
