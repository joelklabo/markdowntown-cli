# Migration Plan: Template Model (placeholders + validation)
Date: 2025-12-01  
Issue: markdowntown-7z8.14

## Scope
- Introduce `Template` entity with placeholder schema and validation.
- Support public/unlisted/private visibility, tags, stats (views, copies, downloads, uses).
- Keep compatibility with existing Snippet flows; templates are distinct objects.

## Steps
1) **Prisma schema**
   - Model `Template`: `id`, `slug` (unique), `title`, `description?`, `body` (markdown with placeholders), `fields` (jsonb), `visibility` enum, `tags` string[], stats (`views`, `copies`, `downloads`, `uses`), `userId?`, timestamps.
   - Indexes: `(userId)`, `(visibility)`, optional `(createdAt)`, `(updatedAt)`.
2) **Placeholder schema**
   - `fields` array items: `{ name, type (text|textarea|select|multi-select|number|boolean), default?, required?, description?, validation? }`.
   - Validation rules: name is slug-safe; type recognized; defaults match type; length limits; select options unique.
   - Rendering: replace `{{name}}` placeholders in `body` with provided or default values; escape user input.
3) **SQL migration outline**
   - Create `Template` table with columns above; defaults for stats=0, tags empty array.
   - Unique index on `slug`; indexes on `userId`, `visibility`.
4) **Backfill/seed**
   - Seed a few templates with fields to demo builder (e.g., “Agent base”, “Product triage”).
   - Set existing data (if any) to `PRIVATE` by default.
5) **API/contracts**
   - `GET /api/public/templates` and `/api/public/templates/[slug]` (read-only, visibility=PUBLIC).
   - Auth-only `POST/PUT/DELETE` for create/update/delete; include server-side validation of `fields`.
   - Include `fields` + `body` in responses; optionally return rendered preview when values provided.
6) **Validation pipeline**
   - Reuse validation util to enforce field schema and sanitize placeholder values before render/export.
   - Reject body if it contains script/iframe/javascript: URLs.
7) **Caching/ISR**
   - Detail pages/tagged fetches use revalidate tags `template:<slug>`; list feeds `template:list`.
   - Cache headers: `s-maxage=60, stale-while-revalidate=300` for lists; `s-maxage=300` for detail.
8) **Testing**
   - Migration smoke: create template, render with placeholder values, validate bad fields, ensure unique slug.
   - API tests for create/update/delete with validation errors.

## Risks
- User-supplied placeholder values could inject HTML—must sanitize rendered output.
- Large `fields` JSON can bloat payloads—consider trimming description lengths and limiting field count.
