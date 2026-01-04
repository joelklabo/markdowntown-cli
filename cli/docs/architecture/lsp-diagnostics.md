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

## Ordering and Noise Control

- Prefer deterministic ordering: severity desc, rule ID asc, path asc.
- If multiple diagnostics target the same range, keep the most actionable and demote the rest to related information.
- Trim related information to avoid long evidence dumps.

## Cross-links

- Diagnostic catalog: docs/architecture/diagnostic-catalog.md
- Audit rule catalog: cli/docs/audit-spec-v1.md
