# Monorepo Test Prompt

Slash command: `/monorepo-tests`

Use this prompt when you need a consistent testing checklist across CLI + web packages.

## Inputs
- Task ID + affected areas (cli/web/docs).
- Whether Playwright or VS Code extension tests are required.

## Test matrix
- CLI: `cd cli && make lint`, `cd cli && make test`.
- Web: `pnpm -C apps/web lint`, `pnpm -C apps/web compile`, `pnpm -C apps/web test:unit`.
- Docs-only: `pnpm -C apps/web lint:md`.
- VS Code extension: `make lsp-vscode-test` (when LSP UX changes).

## Evidence to capture
- Commands run and any warnings/errors.
- Screenshots path if UI/VS Code changes apply.
- CI command(s) used.
