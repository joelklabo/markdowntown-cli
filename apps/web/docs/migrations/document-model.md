# Migration Plan: Document (agents.md) Model
Date: 2025-12-01  
Issue: markdowntown-7z8.13

## Scope
- Add `Document` table for saved agents.md files.
- Add ordered join `DocumentSnippet` to store snippet references and per-item overrides.
- Enable public/unlisted/private visibility and stats (views/copies/downloads).

## Steps
1) **Prisma schema**
   - Model `Document`: `id`, `slug` (unique), `title`, `description?`, `renderedContent?`, `visibility` enum, `tags` string[], stats (`views`, `copies`, `downloads`), `userId?`, timestamps, `snippets` relation.
   - Model `DocumentSnippet`: `documentId`, `snippetId`, `position`, `overrides` (jsonb), relations with cascade delete.
   - Indexes: `Document` on `(userId)`, `(visibility)`, `(createdAt)`, `(updatedAt)`; `DocumentSnippet` composite id `(documentId, position)` + index `(snippetId)`.
2) **SQL migration outline**
   - Create `Document` table with columns above and default counters 0.
   - Create `DocumentSnippet` table with FK to `Document` and `Snippet` (cascade on delete).
   - Unique/composite constraint on `(documentId, position)`; optional unique `(documentId, snippetId)` to avoid duplicates if desired.
3) **Backfill (optional)**
   - If existing saved agents exist, insert as Document with ordered snippets; else seed 1–2 demo Documents for public library.
4) **API/contracts**
   - Add `/api/public/documents` list + detail (read-only, visibility=PUBLIC).
   - Add authed endpoints for create/update/delete; builder export writes Document when user chooses Save.
   - Include ordered snippets and overrides in responses.
5) **Builder integration**
   - Export flow: assemble snippets → render → store `renderedContent`; write Document + DocumentSnippets with positions.
   - Clone: allow copying a public Document into user scope with new slug and ownership.
6) **Cache/ISR**
   - Detail pages revalidate on Document/DocumentSnippet change; tag `document:<slug>`.
   - List feeds cached with `s-maxage=60`/`stale-while-revalidate=300`.
7) **Testing**
   - Migration smoke: create Document with snippets, reorder, delete; ensure cascades work.
   - API tests for visibility filtering and ordered return.

## Risks
- Large documents may need pagination on snippets; keep limit reasonable.
- Overrides JSON needs validation to prevent XSS if rendered; sanitize on write.
