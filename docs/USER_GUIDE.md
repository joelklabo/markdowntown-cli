# User Guide (Monorepo)

This guide is the canonical entry point for Markdowntown CLI + web workflows.

## Web app flow

### Project → Snapshot → Run → Workspace
1. From Home or **Projects**, select an existing project or upload a new snapshot via CLI.
2. In the project dashboard, select a **Snapshot** to view its files and instruction health.
3. Start an **Audit** or **Suggest** run to analyze your instructions.
4. Open a **Workspace** to review results and make edits.
5. Export patches or apply changes back to your local repository via CLI.

## CLI usage
- CLI command + schema details live in `cli/docs/scan-spec-v1.md`, `cli/docs/audit-spec-v1.md`, and `cli/docs/suggest-spec-v1.md`.
- CLI quick reference: `cli/docs/USER_GUIDE.md`.

## VS Code integration
The markdowntown VS Code extension provides real-time diagnostics and quick fixes for AI tooling configuration files.

### Features
- **Real-time Linting**: Surface missing, conflicting, or malformed configs as you type.
- **Quick Fixes**: One-click remediation for common issues (e.g., creating missing repo configs, fixing frontmatter).
- **Metadata Support**: Diagnostics include links to documentation and related information for complex conflicts.

### Settings
| Setting | Default | Description |
| --- | --- | --- |
| `markdowntown.serverPath` | `markdowntown` | Path to the CLI binary. |
| `markdowntown.diagnostics.enabled` | `true` | Toggle real-time diagnostics. |
| `markdowntown.diagnostics.rulesDisabled` | `[]` | List of rule IDs to suppress (e.g., `["MD002"]`). |
| `markdowntown.diagnostics.includeRelatedInfo` | `true` | Show supporting details for diagnostics. |

### Diagnostics in Action
![VS Code Diagnostics](./screenshots/lsp-diagnostics/diagnostics.png)

## CLI sync flow
1. Run a CLI sync command to upload or reference a snapshot (see CLI docs).
2. Open the Workbench handoff link (now integrated into the Workspace flow).
3. Review the snapshot banner, then use **Export patch** or **Copy CLI command** to pull changes back.

## References
- Design system: `docs/DESIGN_SYSTEM.md`.
- Source registry schema: `docs/source-registry.md`.
- Screenshots: `docs/screenshots/cli-sync/`.