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
pnpm lint:md    # Lint markdown files (README.md, docs/)
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

## Azure Blob Storage configuration

The `AZURE_BLOB_CONTAINER_URL` environment variable configures blob storage for CLI sync snapshots.

### Format
```
AZURE_BLOB_CONTAINER_URL=https://<account>.blob.core.windows.net/<container>?<sas-token>
```

Components:
- `<account>`: Azure storage account name
- `<container>`: Blob container name (e.g., `snapshots`)
- `<sas-token>`: SAS token with required permissions (read, write, delete)

### Example
```bash
# Using a SAS token (recommended for local dev)
AZURE_BLOB_CONTAINER_URL="https://myaccount.blob.core.windows.net/snapshots?sv=2022-11-02&ss=b&srt=o&sp=rwdlacu&se=2024-12-31T23:59:59Z&sig=..."
```

### SAS token requirements
- **Permissions**: Read (r), Write (w), Delete (d), List (l) on blob objects
- **Resource type**: Object (o)
- **Expiry**: Set appropriate expiry; rotate before it expires

### Security notes
- **Never commit SAS tokens** to source control; use environment variables or secrets management
- Errors from this module automatically redact SAS token parameters from logs
- For production, use Managed Identity instead of SAS tokens when possible

## Storage quotas and limits

The CLI sync feature enforces storage limits at multiple levels to prevent abuse.

### Per-snapshot limits
| Limit | Value | Description |
|-------|-------|-------------|
| `MAX_SNAPSHOT_FILES` | 5,000 | Max files per snapshot |
| `MAX_SNAPSHOT_TOTAL_BYTES` | 50 MB | Max total size per snapshot |
| `MAX_SNAPSHOT_FILE_BYTES` | 5 MB | Max size per individual file |

### User-level quota
| Limit | Value | Description |
|-------|-------|-------------|
| `MAX_USER_STORAGE_BYTES` | 500 MB | Max total storage across all user snapshots |

The user-level quota aggregates all non-deleted files across all snapshots for a given user. When a user approaches or exceeds their quota:
- New uploads are rejected with HTTP 413 (Payload Too Large)
- The rejection is logged with user ID and requested size for observability
- Deleting old snapshots or files reclaims quota immediately

### Quota calculation notes
- Quota is calculated from `SnapshotFile.sizeBytes` where `isDeleted = false`
- Blob deduplication does not affect quota (same blob in two files counts twice)
- Concurrent uploads may briefly exceed quota in race conditions; final writes are still validated

These constants are defined in `apps/web/src/lib/validation.ts`.
