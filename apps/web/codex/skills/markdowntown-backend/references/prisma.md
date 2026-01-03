# Prisma + migrations

## Key files
- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/*`
- Client setup: `src/lib/prisma.ts`

## Environment
- `DATABASE_URL` must be a Postgres URL (`postgres://` or `postgresql://`).
- `SKIP_DB=1` disables DB usage in environments without Postgres.
- `hasDatabaseEnv` in `src/lib/prisma.ts` gates DB-dependent behavior.

## Migration workflow
- Create migration: `pnpm prisma migrate dev --name <change>`
- Regenerate client: `pnpm prisma generate`
- Commit the generated migration folder under `prisma/migrations`.
- Production applies migrations with `pnpm prisma migrate deploy` (see `docs/MIGRATIONS.md`).

## Usage notes
- Prefer Prisma client imports from `src/lib/prisma.ts`.
- When changing model names/fields, update API routes, cache tags, and tests.
- Be mindful of JSON fields; sanitize or validate before render.
