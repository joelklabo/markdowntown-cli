# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

This is a monorepo containing:
- `cli/`: Go CLI + LSP server + VS Code extension for scanning AI config files
- `apps/web/`: Next.js web app with Prisma, NextAuth, and blob storage
- `packages/*`: Shared packages (when present)

## Common Development Commands

### Build & Test (Unified)
Run from repo root:
```bash
pnpm dev        # Start web dev server, worker, and WASM watcher
pnpm lint       # Lint both CLI (Go) and web (TypeScript)
pnpm test       # Run all tests (CLI + web)
pnpm lint:md    # Lint markdown files
```

### CLI (Go)
Run from `cli/` directory:
```bash
make build      # Build binary to bin/markdowntown
make test       # Run Go tests
make lint       # Run golangci-lint, shellcheck, yamllint, markdown lint, and catalog check
make fmt        # Format Go code
make coverage   # Generate coverage report
make install    # Install to $GOPATH/bin

# LSP development
make lsp-vscode      # Build and launch VS Code extension
make lsp-vscode-test # Run automated LSP tests
```

### Web App (Next.js)
Run from repo root with `-C apps/web` or from `apps/web/`:
```bash
pnpm -C apps/web dev        # Start dev server
pnpm -C apps/web build      # Production build
pnpm -C apps/web lint       # ESLint + custom hex/neutral checks
pnpm -C apps/web compile    # Type check with tsc
pnpm -C apps/web test:unit  # Run Vitest unit tests
pnpm -C apps/web test:e2e   # Run E2E tests
```

### Test Execution
- **CLI**: Single test: `go test ./internal/scan -run TestSpecificFunction`
- **Web**: Single test: `pnpm -C apps/web test -- path/to/test.test.ts`
- **Web E2E**: `E2E_BASE_URL=http://localhost:3000 pnpm -C apps/web test:e2e`

## Architecture

### CLI Architecture
- **Entry point**: `cli/cmd/markdowntown/main.go`
- **Core packages**:
  - `internal/scan`: Pattern-based file scanning with parallel workers
  - `internal/audit`: Config analysis and issue detection
  - `internal/suggest`: Evidence-backed instruction suggestions
  - `internal/sync`: Upload/download snapshots to web app
  - `internal/auth`: Authentication (device flow + token)
  - `internal/lsp`: LSP server implementation
  - `internal/engine`: Shared scan/audit logic (also compiled to WASM)
- **Pattern registry**: `cli/data/ai-config-patterns.json` (strict JSON, defines all supported AI tools)
- **Specs**: `cli/docs/scan-spec-v1.md`, `cli/docs/audit-spec-v1.md`, `cli/docs/suggest-spec-v1.md`

### Web App Architecture
- **Framework**: Next.js 16 (App Router) with React 19
- **Database**: Prisma with PostgreSQL
- **Auth**: NextAuth with Prisma adapter
- **Storage**: Azure Blob Storage with DB fallback for snapshots/patches
- **Key directories**:
  - `src/app`: App Router pages and API routes
  - `src/components`: React components
  - `src/lib`: Utilities and validation
  - `src/services`: Business logic (snapshots, patches, blob storage)
  - `prisma/`: Database schema and migrations

### Shared Engine
The scan/audit engine in `cli/internal/engine` is compiled to:
- Native binary (CLI)
- WASM (`cli/cmd/engine-wasm`) for web workers
- Worker binary (`cli/cmd/engine-worker`)

Build WASM: `pnpm wasm:build`
Test WASM: `pnpm wasm:smoke`

## Workflow & Quality Gates

### Before Finishing Work
1. Run appropriate lint/test commands for changed code
2. **CLI changes**: `cd cli && make lint && make test`
3. **Web changes**: `pnpm -C apps/web lint && pnpm -C apps/web compile && pnpm -C apps/web test:unit`
4. **Docs-only**: `pnpm lint:md`
5. CI must be green; investigate and fix all failures before completing work

### Git Workflow
- Prefer small, deterministic changes aligned with specs
- Avoid destructive git commands unless explicitly requested
- Follow the "Landing the Plane" workflow in `AGENTS.md` when ending sessions
- Use `npx bd --no-daemon ...` for issue tracking (bd tool manages .beads/ directory)

### Code Style
- **Go**: Use `gofmt`, follow golangci-lint rules
- **TypeScript**: ESLint config in `apps/web/eslint.config.mjs`
- Prefer `rg` (ripgrep) for searching codebase
- Add/update tests when behavior changes

## Key Files & Locations

### Configuration
- CLI pattern registry: `cli/data/ai-config-patterns.json`
- Suggestion sources: `cli/data/doc-sources.json` (or via XDG config)
- Web env vars: `apps/web/.env.example` (copy to `.env.local`)
- Prisma schema: `apps/web/prisma/schema.prisma`

### Documentation
- Monorepo: `docs/DEV_ONBOARDING.md`, `docs/USER_GUIDE.md`
- CLI: `cli/docs/scan-spec-v1.md`, `cli/docs/audit-spec-v1.md`, `cli/docs/USER_GUIDE.md`
- Web: `apps/web/docs/DEV_ONBOARDING.md`, `apps/web/docs/USER_GUIDE.md`

### Agent Instructions
- Root: `AGENTS.md` (monorepo workflow, session completion checklist)
- CLI: `cli/AGENTS.md` (CLI-specific workflow)
- Web: `apps/web/AGENTS.md` (bd-based workflow, issue tracking)

### Codex Integration
- Skills: `codex/skills/` (source of truth), synced to `.codex/skills/` or `~/.codex/skills/`
- Prompts: `codex/prompts/`

## CLI Output Contracts

The CLI maintains **strict output schemas** for machine consumption:
- All JSON output is deterministic and sorted
- Schema versions in output: `schemaVersion`, `toolVersion`, `registryVersion`
- Breaking changes require spec updates in `cli/docs/`
- Audit rules emit structured diagnostics with severity levels

## Storage & Limits

### Per-Snapshot Limits (Web)
- Max files: 5,000
- Max total size: 50 MB
- Max file size: 5 MB

### User Quota
- Max total storage: 500 MB across all snapshots
- Calculated from non-deleted `SnapshotFile.sizeBytes`

See `apps/web/src/lib/validation.ts` for constants.

## Blob Storage Configuration

### Environment Variables
- `AZURE_BLOB_CONTAINER_URL`: Azure blob storage URL with SAS token
- `BLOB_STORE_PRIMARY`: `azure` or `db` (default: Azure if configured, else DB)
- `BLOB_STORE_FALLBACK`: Enable dual-read fallback for migrations

### Format

```text
https://<account>.blob.core.windows.net/<container>?<sas-token>
```

## Special Notes

- **Git is required**: CLI requires `git` in PATH for repo detection and gitignore checks
- **Deterministic ordering**: Scan/audit output must be sorted and reproducible
- **XDG compliance**: Config/cache paths follow XDG base directory spec on Unix
- **Global scope**: `--global-scope` scans `/etc` (Unix only, opt-in)
- **Test data**: `cli/testdata/` contains fixture repos for integration tests
- **Markdown linting**: Enforced via markdownlint with config in `.markdownlint.json`

## Common Tasks

### Add New AI Tool Pattern
1. Edit `cli/data/ai-config-patterns.json`
2. Add pattern with unique `id`, `toolId`, `scope`, `paths`, etc.
3. Run `markdowntown registry validate` to check syntax
4. Add tests in `cli/cmd/markdowntown/*_test.go`
5. Update docs if needed

### Run Single Test
```bash
# Go
cd cli && go test ./internal/scan -run TestPatternMatching -v

# Web
pnpm -C apps/web test -- src/lib/validation.test.ts
```

### Debug LSP
```bash
cd cli
make lsp-vscode  # Launches VS Code with extension
# Check Output panel > markdowntown LSP
```

### Update Database Schema
```bash
cd apps/web
# Edit prisma/schema.prisma
npx prisma migrate dev --name describe_change
npx prisma generate
```

## CI & Automation

- GitHub Actions workflows in `.github/workflows/`
- Pre-commit hooks via Husky in `apps/web/.husky/`
- Lefthook config in `.lefthook.yml`
- CI must pass before merging (enforced in workflow)
