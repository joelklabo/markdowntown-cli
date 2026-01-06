# API routes (App Router)

## Common structure
- Routes live in `src/app/api/**/route.ts` with `export async function GET/POST/PUT/DELETE`.
- Use `NextResponse.json(...)` for consistent JSON responses.

## Auth + rate limiting
- Private routes call `requireSession()` early and return `response` if missing.
- Rate limiting uses `rateLimit(key)` and abuse logging via `logAbuseSignal`.
- Example: `src/app/api/sections/route.ts` (create + list), `src/app/api/sections/[id]/route.ts` (update/delete).

## Parsing + validation
- Parse JSON with `await request.json().catch(() => ({}))` to avoid exceptions.
- Normalize fields (trim, default to empty strings) and validate via shared helpers.
- Return 400 with `{ error }` for validation failures.

## Data writes + cache invalidation
- Use Prisma via `prisma.<model>.<op>` (e.g., `snippet.create/update/delete`).
- After mutations, call `safeRevalidateTag` for:
  - `cacheTags.list("all")` and list tags for the specific type
  - `cacheTags.detail(type, slugOrId)`
  - `cacheTags.tags` and `cacheTags.landing` when applicable

## Error handling
- Favor explicit 4xx for validation/auth and avoid leaking Prisma errors directly.
- Use `NextResponse.json({ error: message }, { status })` for consistency.
