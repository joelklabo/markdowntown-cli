# Developer Onboarding (Monorepo)

This repo hosts the Markdowntown CLI, LSP/VS Code extension, and the web app.

## Prerequisites
- Go 1.25
- Node.js 20
- pnpm 9 (via corepack)
- golangci-lint (for `make lint`)
- VS Code (optional, for LSP workflows)

## Install dependencies
```bash
corepack enable
pnpm install
cd cli && go mod download
```

## Unified commands (Recommended)
Run these from the repo root:
```bash
pnpm dev        # Start web, worker, and WASM watcher
pnpm lint       # Lint both web and CLI
pnpm test       # Run all tests (web and CLI)
```

## Web app (apps/web)
```bash
pnpm -C apps/web dev
pnpm -C apps/web lint
pnpm -C apps/web test
pnpm -C apps/web compile
```

Web environment variables live in `apps/web/.env.example` (copy to `apps/web/.env.local`).

## CLI (cli/)
```bash
cd cli
make build
make test
make lint
```

## VS Code LSP
```bash
cd cli
make lsp-vscode
make lsp-vscode-test
```

## CLI sync flow (local)
1. Run the web app on http://localhost:3000.
2. Use the CLI sync flow to generate a Workbench link (or open Workbench with query params such as `cliRepoId`, `cliSnapshotId`, `cliBranch`, `cliStatus`).
3. In Workbench, use **Export patch** or **Copy CLI command** to pull changes back locally.

See `apps/web/docs/DEV_ONBOARDING.md` for web-specific details and `cli/docs/USER_GUIDE.md` for CLI flags.

## AI workflows
- Repo guidance: `AGENTS.md` (root) and `cli/AGENTS.md` (CLI-only).
- Codex skills: `codex/skills/` (monorepo + CLI skills).
- Prompt templates: `codex/prompts/` (common scan/test flows).
