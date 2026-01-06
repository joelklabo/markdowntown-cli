# Documentation Inventory

The canonical machine-readable inventory lives in `docs/doc-inventory.json` and is refreshed by the docs freshness pipeline (`scripts/docs/refresh.ts` or `POST /api/docs/refresh`). Last-good snapshots are stored under `.cache/docs/inventory/last-good.json` (override with `DOC_STORE_PATH`). See `docs/runbooks/docs-refresh.md` for operational steps and alerting.

## Schema

- `version` (string): inventory schema version.
- `updatedAt` (string, optional): ISO timestamp of the latest refresh.
- `documents` (array):
  - `id` (string, unique)
  - `title` (string)
  - `url` (https URL to the authoritative document)
  - `client` (string, optional)
  - `tags` (string[], optional)
  - `checksum` (string, optional; content hash if available)

## Seed inventory

`docs/doc-inventory.json` seeds the pipeline with user guides, design system docs, and the source registry spec. Extend this file when adding new canonical docs; the refresh job will validate IDs/URLs and publish the latest JSON snapshot for consumers.

## Assets

- `docs/screenshots/lsp/document-symbols.png`: UI view of the document symbols tree in VS Code.
- `cli/docs/screenshots/lsp-diagnostics/diagnostics.png`: Example of LSP diagnostics and quick fixes.
