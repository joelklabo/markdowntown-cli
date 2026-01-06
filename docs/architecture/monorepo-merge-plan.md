# Monorepo layout + CI migration plan

## Summary
Unify the CLI and web app in a single repo with shared tooling, explicit ownership, and CI jobs that scope to only the paths they need.

## Target layout



| Path | Owner | Purpose |

| --- | --- | --- |

| `apps/web` | Web | Next.js app, API routes, Prisma, UI assets. |

| `cli` | CLI | Go CLI + LSP + VS Code extension. |

| `packages/*` | Shared | Shared JS/TS packages (when present). |

| `docs` | Product/Eng | Architecture, UX, runbooks, QA evidence. |

| `infra` | Infra | Deployment, IaC, and environments. |

| `scripts` | Platform | Repo-wide scripts and helpers. |



Notes:


- Keep `cli/vscode-extension` colocated with the CLI so the extension can bundle the matching binary.
- Keep `apps/web` isolated from Go build artifacts to avoid noisy diffs.

## Versioning + tagging strategy
- CLI releases use `vX.Y.Z` tags (goreleaser) at repo root.
- VS Code extension releases use `vscode-vX.Y.Z` tags.
- Reserve a `web-vX.Y.Z` prefix if the web app adds tagged releases.
- Extension packaging must assert the bundled CLI binary matches the extension version.

## go.work + module path migration
### go.work usage
- Root `go.work` includes `./cli` and any future Go modules (for example, a shared engine module).
- Go commands should run from repo root or `cli`, with tooling respecting `go.work`.
- Commit `go.work.sum` if tooling generates it to keep CI and local dev aligned.

### Module path migration steps
1. Audit downstream usage of the current module path and document the deprecation plan.
2. Confirm the canonical module path for the monorepo (for example, `github.com/markdowntown/markdowntown/cli`).
3. Update `cli/go.mod` with the new module path and adjust all internal import paths.
4. Update any scripts or tooling that reference the old module path (build scripts, CI, editor tasks).
5. Update `cli/vscode-extension` binary lookup if it embeds module path assumptions.
6. Run `go mod tidy` and verify `make lint` + `make test` still pass.

## CLI release pipeline changes
- Keep goreleaser working from `cli` while tags are created at repo root.
- Ensure release workflows set `workdir: cli` and use `cli/go.sum` for cache paths.
- Update goreleaser config to read git tags from repo root and set explicit `project_name`/`builds.dir` as needed.
- VS Code release pipeline should build the CLI binary from `cli/cmd/markdowntown` and stage it under `cli/vscode-extension/bin`.
- Pass CLI binaries as artifacts into the VS Code packaging job and verify version alignment.

## CI plan
### Job matrix
- **Go (CLI)**: lint + test + build on Linux/macOS/Windows, plus cross-build on Linux.
- **Web**: install + lint + unit tests + build on Node 20.
- **VS Code extension**: npm install + build + extension tests; packages on release tags.

### Triggers + path filters
- PRs and pushes to `main` run the full suite for changed areas.
- Suggested path filters:
  - Go jobs: `cli/**`, `go.work*`, `.github/workflows/**`, `scripts/**`, `README.md`, `LICENSE`.
  - Web jobs: `apps/web/**`, `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/**`, `README.md`.
  - Extension jobs: `cli/vscode-extension/**`, `cli/**`, `.github/workflows/**`, `README.md`.
- Add a docs-only workflow or explicit `paths-ignore: [\"docs/**\"]` so doc-only PRs still produce a green status.

### Cache strategy
- Go: `actions/setup-go` with `cache: true` and `cache-dependency-path: cli/go.sum`.
- pnpm: `actions/setup-node` with `cache: pnpm` and `pnpm-lock.yaml`.
- Extension: `actions/setup-node` with `cache: npm` and `cli/vscode-extension/package-lock.json`.

## Edge cases + mitigations
- **VS Code extension binary path assumptions**: keep the binary under `cli/vscode-extension/bin` and guard with build-time checks.
- **Go import path changes**: update all internal imports and any third-party references that embed the module path.
- **CI path filters skipping required jobs**: include `.github/workflows/**` and shared scripts in filters; add manual re-run guidance.
- **Tag collisions or drift**: use explicit tag prefixes to avoid web/CLI release overlap.
- **Windows path handling**: validate `.exe` resolution and path separators in extension tests.

## Rollback plan
- Keep migration changes in a single PR so they can be reverted atomically.
- Block releases until CI passes on the merged layout.
- If a release pipeline breaks, revert workflow + layout changes and re-tag.

## Migration checklist
1. Confirm target layout and ownership in this doc.
2. Decide and document tag naming conventions.
3. Update module path and imports.
4. Align build scripts and release workflows to `cli` working directory.
5. Add or adjust CI path filters + caches.
6. Ensure CLI binaries flow into extension packaging with version checks.
7. Update CODEOWNERS for new path ownership.
8. Confirm CI secrets/permissions for goreleaser and VS Code publishing.
9. Document root-level lint/test entrypoints (or ensure they work).
10. Verify `make lint`, `make test`, and web CI steps pass.
