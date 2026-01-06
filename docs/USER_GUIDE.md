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

Configure the extension via `settings.json` or the Settings UI.

| Setting | Default | Description |
| --- | --- | --- |
| `markdowntown.serverPath` | `markdowntown` | Path to the `markdowntown` binary. |
| `markdowntown.diagnostics.enabled` | `true` | Enable or disable real-time diagnostics. |
| `markdowntown.diagnostics.delayMs` | `500` | Debounce delay in milliseconds after changes before running diagnostics. |
| `markdowntown.diagnostics.rulesEnabled` | `[]` | List of rule IDs to exclusively enable. If empty, all non-disabled rules are run. |
| `markdowntown.diagnostics.rulesDisabled` | `[]` | List of rule IDs to suppress (e.g., `["MD002"]`). |
| `markdowntown.diagnostics.severityOverrides` | `{}` | Map of rule IDs to severity levels (e.g., `{"MD005": "error"}`). |
| `markdowntown.diagnostics.includeRelatedInfo` | `true` | Show supporting details and cross-file references. |
| `markdowntown.diagnostics.includeEvidence` | `true` | Include rule-specific evidence in the diagnostic message. |
| `markdowntown.diagnostics.redactPaths` | `auto` | Path redaction mode (`auto`, `always`, `never`). |

### Configuration Example

```json
{
  "markdowntown.diagnostics.rulesDisabled": ["MD002"],
  "markdowntown.diagnostics.severityOverrides": {
    "MD005": "error"
  },
  "markdowntown.diagnostics.delayMs": 1000
}
```

### Metadata and Payloads
Settings like `includeRelatedInfo` and `includeEvidence` control the richness of the diagnostic output. Disabling `includeRelatedInfo` removes links to other configuration files that might be causing a conflict, while `includeEvidence` removes the specific triggers (like byte size or specific keys) from the error message.

### Diagnostics in Action


![VS Code Diagnostics](./screenshots/lsp-diagnostics/diagnostics.png)

### Packaging
The extension is packaged with platform-specific binaries for the `markdowntown` server to ensure zero-install functionality. Download the appropriate VSIX for your platform from the Releases page.

## CLI sync flow
1. Run a CLI sync command to upload or reference a snapshot (see CLI docs).
2. Open the Workbench handoff link (now integrated into the Workspace flow).
3. Review the snapshot banner, then use **Export patch** or **Copy CLI command** to pull changes back.

## References
- Design system: `docs/DESIGN_SYSTEM.md`.
- Source registry schema: `docs/source-registry.md`.
- Screenshots: `docs/screenshots/cli-sync/`.
