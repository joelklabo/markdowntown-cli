# User Guide (Monorepo)

This guide links the CLI and web documentation and highlights the CLI sync flow.

## CLI user guide
- See `cli/docs/USER_GUIDE.md` for CLI commands, flags, and LSP diagnostics.

## Web app user guide
- See `apps/web/docs/USER_GUIDE.md` for Scan/Library/Translate → Workbench flows.

## CLI sync flow
1. Run a CLI sync command to upload or reference a snapshot (see CLI docs).
2. Open the Workbench handoff link (or `/workbench` with `cliRepoId`, `cliSnapshotId`, `cliBranch`, `cliStatus`).
3. Review the snapshot banner, then use **Export patch** or **Copy CLI command** to pull changes back to the CLI.

Screenshots for the CLI sync flow live in `docs/screenshots/cli-sync/`.
