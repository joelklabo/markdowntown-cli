# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-06

### Added
- **Monorepo**: Unified `cli` and `apps/web` into a single repository with shared tooling and CI/CD.
- **CLI Sync**: New `markdowntown login`, `upload`, and `pull` commands enabling end-to-end snapshot sync with the web app.
- **Web App**: 
  - Projects/Snapshots data model and UI.
  - CLI token management and device flow authentication.
  - Workspace editor for online edits and patch generation.
  - Server-side audit/suggest runs powered by the shared engine.
- **Engine**: Shared scan/audit logic refactored into `cli/internal/engine` and `packages/engine-js` (WASM).
- **LSP**: Enhanced VS Code extension with real-time diagnostics, quick fixes, and deep documentation linking.
- **Infrastructure**: Complete Azure Bicep IaC for Container Apps, Jobs, Storage, and Observability.
- **Observability**: OpenTelemetry tracing, structured logging, and Azure Monitor integration.

### Changed
- **CLI**: Moved to `/cli` directory. Default config path remains `~/.config/markdowntown` or `$XDG_CONFIG_HOME`.
- **Web**: Re-architected data model to support Projects -> Snapshots -> Runs.
- **Docs**: Consolidated documentation into root `docs/` folder.

[1.0.0]: https://github.com/joelklabo/markdowntown-cli/releases/tag/v1.0.0
