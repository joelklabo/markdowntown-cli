# Database Migration Policy

- Tooling: Prisma migrate.
- Default dev DB: Postgres (local or containerized). Prod: Azure PostgreSQL.

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
- Ensure `DATABASE_URL` points to a Postgres database before running migrations.
- Reset dev DB: `pnpm prisma migrate reset` (will wipe data).
- Use `pnpm prisma studio` for inspecting data locally.

## Recent migrations

### 2026-01-05: CLI Token Security Enhancements
- **Added `tokenPrefix` column** to `CliToken` model (first 8 chars for display)
- **Enhanced token verification** with constant-time compare to prevent timing attacks
- **Improved revocation handling** - `findCliToken()` now checks `revokedAt` and `expiresAt`
- See `docs/SECURITY.md` for token rotation and revocation best practices
- Migration: `npx prisma migrate dev --name add_token_prefix`
