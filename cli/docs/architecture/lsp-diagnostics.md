# VS Code Diagnostics UX Guide

## Purpose

Define how markdowntown diagnostics should appear in VS Code. This document focuses on message copy, severity mapping, and how to use LSP metadata (codeDescription, related information, tags, and data).

References:

- docs/architecture/diagnostic-catalog.md
- cli/docs/audit-spec-v1.md
- [VS Code programmatic language features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features)
- [LSP specification 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)

## Diagnostic Message Structure

### Message format

- Use a short, action-oriented message.
- If a title exists, prefix the message with the title: `Title: message`.
- Do not embed long evidence or stack traces in the message body.

### Source and code

- `source`: `markdowntown`.
- `code`: stable rule ID (MD000+).

### Severity mapping

- **Error**: user action required, repo-wide impact.
- **Warning**: likely to confuse or create drift.
- **Info**: guidance and best practices.
- **Hint**: low-urgency or optional guidance.

### Severity overrides

Severity overrides allow users to customize diagnostic severity on a per-rule basis via LSP settings.

**How they work:**

1. Rules are evaluated with their default severity (defined in `internal/audit`).
2. After evaluation, if a `severityOverride` is configured for the rule ID, the diagnostic severity is replaced.
3. Rule matching is case-insensitive (e.g., `md003` matches `MD003`).
4. Overrides only affect diagnostics; they don't change rule evaluation or filtering logic.

**Precedence:**

- Overrides are applied after rules are evaluated but before filtering by `rulesEnabled`/`rulesDisabled`.
- If a rule is disabled via `rulesDisabled`, no diagnostic is published (override is irrelevant).
- If `rulesEnabled` is set and doesn't include the rule, no diagnostic is published (override is irrelevant).

**Example VS Code configuration:**

```json
{
  "markdowntown.diagnostics.severityOverrides": {
    "MD003": "warning",
    "MD007": "info",
    "MD012": "hint"
  }
}
```

**Valid severity values:**

- `"error"`, `"warning"`, `"info"`, `"hint"`
- Invalid values are logged as warnings and ignored.

**Limitations:**

- Severity overrides only affect diagnostic display; they don't change rule behavior or suggestions.
- Unknown rule IDs are accepted but have no effect (the rule must exist and produce a diagnostic).
- Overrides persist until configuration changes via `workspace/didChangeConfiguration`.

### Ranges and indexing

- LSP ranges are 0-based line and character offsets (UTF-16 code units).
- Avoid off-by-one conversions when mapping frontmatter locations.

### Lifecycle and staleness

- Publish an empty diagnostics array to clear stale entries on file close or when no issues remain.
- On `didChange`, replace the full diagnostics set for the file to avoid lingering errors.

### Performance and debounce

- Use debounced diagnostics on `didChange` for fast feedback.
- If analysis is expensive, prefer `didSave` or a longer debounce window.

## LSP Metadata Usage

### codeDescription

- Provide a link to the rule documentation when available.
- Prefer an anchor in `cli/docs/audit-spec-v1.md` or the diagnostic catalog.
- Omit `codeDescription` if the rule is undocumented.

### relatedInformation

Use for supporting details, not the primary message. Suggested entries (limit to 3):

- Suggestion (if present)
- Tools (toolId + kind)
- Related configs (paths)
- Evidence summary (short, human-readable)

### tags

- Use `Unnecessary` for shadowed or ignored configs (e.g., empty, shadowed by higher precedence).
- Use `Deprecated` for obsolete file names or deprecated workflows.

### data payload

Include structured data for code actions and tests:

- `ruleId`, `title`, `suggestion`, `severity`, `fingerprint`
- `category`, `docUrl`
- `paths`, `tools`
- `evidence`
- `quickFixes` (optional list of action titles)

### Code action linkage

- Use `diagnostic.code` and `diagnostic.data.ruleId` to map quick fixes.
- Avoid parsing the message text for action routing.

## Quick Fix Copy

### Guidelines

- Start with a verb: `Remove`, `Add`, `Create`, `Allow`, `Replace`.
- Keep titles short and specific.
- Avoid extra punctuation.

### Examples

- `Remove frontmatter`
- `Insert placeholder config`
- `Create repo config`
- `Allow config in .gitignore`
- `Remove duplicate frontmatter`

## Diagnostic Examples

| Rule | Message | Suggestion | Tag |
| --- | --- | --- | --- |
| MD000 | LSP error: Registry not found | Set markdowntown.registryPath or MARKDOWNTOWN_REGISTRY | none |
| MD001 | Config conflict: Conflicting configs for cursor (rules) in repo scope. | Keep exactly one config for this tool/kind/scope. | none |
| MD002 | Gitignored config: Repo config is ignored by git; teammates and CI will not see it. | Remove this path from .gitignore or move the file. | Unnecessary (optional) |
| MD003 | Invalid YAML frontmatter: Invalid YAML frontmatter. | Fix the YAML frontmatter syntax or remove it entirely. | none |
| MD004 | Empty config file: Config file is empty and will be ignored. | Add the intended instructions or delete the file. | Unnecessary |
| MD005 | No repo config: No repo-scoped config for cursor (rules); only user/global configs detected. | Add a repo-scoped config for consistent behavior across teammates and CI. | none |
| MD006 | Config unreadable: Config file could not be read. | Check the file permissions and ensure the path exists. | none |
| MD007 | Duplicate frontmatter value: Multiple skills configs share name="alpha" in repo scope. | Ensure frontmatter identifiers are unique or consolidate duplicates. | none |
| MD008 | Circular symlink: Circular symlink detected during scan. | Break the symlink loop or remove the entry. | none |
| MD010 | Scan warning: Scan warning encountered during discovery. | Verify permissions and registry paths, then re-run the scan. | none |
| MD011 | Binary config content: Binary config content was skipped. | Replace the file with text instructions or remove it. | Unnecessary |
| MD012 | Missing frontmatter identifier: Missing required frontmatter identifier for codex (skills). | Add one of: name, title, id. | none |
| MD015 | Unknown toolId: Unknown toolId: codx-cli | Replace with codex-cli. | none |

## CodeLens Visibility

Provide a visual indicator at the top of configuration files showing their effective status.

### Labels

- **Active (Repo Scope)**: The file is the primary configuration for the tool in this repo.
- **Active (User Scope)**: The file is the primary configuration for the tool across all repos for this user.
- **Shadowed by [path]**: The file is ignored because another configuration has higher precedence.

### Visibility logic and precedence

CodeLens uses the `internal/scan` effective config resolution to determine visibility:

1. **Scope precedence**: `repo` > `user` > `global`. A configuration in a more specific scope shadows those in broader scopes for the same `toolId` and `kind`.
2. **Override pairs**: Specific file patterns may supersede others within the same scope. For example, `AGENTS.override.md` always shadows `AGENTS.md` if both exist in the same directory.
3. **Multi-file behavior**: Tools that support `loadBehavior: "merge"` or `append` may show multiple "Active" lenses instead of shadowing. Shadowing applies only to `loadBehavior: "replace"` (default).

### Implementation notes

- Trigger CodeLens only on files matching the pattern registry.
- Resolve absolute vs relative paths carefully when comparing current file to the shadowing path.
- In multi-root workspaces, evaluate precedence relative to the workspace folder root.

## Ordering and Noise Control

- Prefer deterministic ordering: severity desc, rule ID asc, path asc.
- If multiple diagnostics target the same range, keep the most actionable and demote the rest to related information.
- Trim related information to avoid long evidence dumps.

## Cross-links

- Diagnostic catalog: docs/architecture/diagnostic-catalog.md
- Audit rule catalog: cli/docs/audit-spec-v1.md
