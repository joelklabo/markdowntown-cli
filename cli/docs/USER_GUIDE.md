# Markdowntown CLI User Guide

## Overview
The CLI scans for AI tooling config files and can audit or suggest improvements. This guide is a quick entry point; the canonical specs live in `cli/docs/`.

## Install / Uninstall

Homebrew:

```bash
brew install markdowntown
brew uninstall markdowntown
```

Go install:

```bash
go install ./cmd/markdowntown
```

Uninstall (Go install):

```bash
rm "$(go env GOPATH)/bin/markdowntown"
```

## Commands

- `markdowntown scan` → see `cli/docs/scan-spec-v1.md` for flags and schema.
- `markdowntown audit` → see `cli/docs/audit-spec-v1.md` for flags and schema.
- `markdowntown suggest` → see `cli/docs/suggest-spec-v1.md` for flags and schema.
- `markdowntown upload` → Uploads a snapshot of the repo along with scan results to the web app.

  **Upload Flags:**

  | Flag | Default | Description |
  | --- | --- | --- |
  | `--repo <path>` | (git root) | Repo path |
  | `--project <name>` | (repo dir) | Project name |
  | `--project-slug <slug>` | (optional) | Project slug |
  | `--project-id <id>` | (optional) | Existing project ID |
  | `--provider <name>` | `local` | Provider label |
  | `--base-url <url>` | (login/env) | Base URL for the web app |
  | `--base-snapshot <id>` | (optional) | Base snapshot ID for delta uploads |
  | `--include-git-ignored` | `false` | Include git-ignored files |
  | `--max-files <n>` | `0` | Preflight max files (0 = unlimited) |
  | `--max-bytes <n>` | `0` | Preflight max total bytes (0 = unlimited) |
  | `--max-file-bytes <n>` | `0` | Preflight max single file size (0 = unlimited) |
  | `--upload-concurrency <n>` | `4` | Parallel blob uploads |
  | `--scan-workers <n>` | `0` | Parallel scan workers (0 = auto) |
  | `--quiet` | `false` | Reduce progress output |

## Authentication

- `markdowntown login --token <token>` stores an app-issued token locally; use `--token-stdin` to avoid shell history (e.g., `cat token.txt | markdowntown login --token-stdin`).
- Running `markdowntown login` without a token starts device flow and prints a verification URL/code; pass `--base-url` (or set `MARKDOWNTOWN_BASE_URL`) for self-hosted targets.
- Tokens are saved to `$XDG_CONFIG_HOME/markdowntown/auth.json` (0600) with the base URL so `sync`/`pull` reuse the same host.

## VS Code LSP diagnostics
- Diagnostics and quick fixes: `cli/docs/architecture/lsp-diagnostics.md`.
- VS Code integration overview: `docs/USER_GUIDE.md`.

![VS Code Diagnostics](./screenshots/lsp-diagnostics/diagnostics.png)

## Related docs
- Canonical user guide (monorepo): `docs/USER_GUIDE.md`.
- Source registry schema: `docs/source-registry.md`.
