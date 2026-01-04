# Monorepo Scan Prompt

Slash command: `/monorepo-scan`

Use this prompt when working on scan/audit changes that touch both CLI and web contexts.

## Context to provide
- Task ID + acceptance criteria.
- Files touched (especially under `cli/internal/scan` and `apps/web`).
- Whether the change affects scan specs in `cli/docs/`.
- Exclude `node_modules/`, `.git/`, build outputs, and test fixtures unless directly relevant.

## Required checks
- CLI: `cd cli && make lint` and `cd cli && make test`.
- Web (if touched): `pnpm -C apps/web lint`, `pnpm -C apps/web compile`, `pnpm -C apps/web test:unit`.
- Docs-only changes: `pnpm -C apps/web lint:md` (plus `cd cli && make lint` if CLI docs change).

## Output expectations
- Summarize behavior changes and error/warning handling.
- Confirm spec alignment with `cli/docs/scan-spec-v1.md`.
- Note any follow-up tasks discovered.
