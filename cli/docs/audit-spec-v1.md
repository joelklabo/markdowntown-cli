# markdowntown audit — v1 Specification

## Overview

**Command**: `markdowntown audit`

`audit` turns a scan inventory into deterministic, actionable issues without modifying files. It is correctness-first: content-aware by default (content is not emitted in output), explicit about ambiguity, and fail-closed when instruction ordering is undefined.

**Implementation**: Go, rule-driven engine
**First feature**: VS Code + Copilot CLI audit rules, metadata-only output

## Primary user case (v1)

A developer or platform engineer runs `markdowntown audit` locally or in CI to surface missing, malformed, or risky AI-tool instruction/config files in a repo. Output must be deterministic, machine-readable, and safe to share (redacted user paths by default).

---

## CLI Interface

### Commands

```text
markdowntown audit [flags]         # Audit scan results and emit issues
```

### audit Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--input` | path | (empty) | Read scan JSON from file or `-` for stdin. When set, scan flags are ignored. |
| `--format` | enum | `json` | Output format: `json` or `md`. |
| `--compact` | bool | false | Minify JSON output (no pretty formatting). Ignored for `md`. |
| `--fail-severity` | enum | `error` | Exit 1 when issues at or above this severity exist. |
| `--redact` | enum | `auto` | Path redaction mode: `auto`, `always`, `never`. |
| `--ignore-rule` | string[] | (none) | Rule IDs to suppress (repeatable). |
| `--only` | string[] | (none) | Run only these rule IDs (repeatable). |
| `--include-scan-warnings` | bool | false | Include raw scan warnings in output. |
| `--exclude` | string[] | (none) | Path globs to exclude from audit matching (repeatable). |
| `--repo` | path | (auto) | Repo root used when audit runs an internal scan. |
| `--repo-only` | bool | false | Exclude user scope when audit runs an internal scan. |
| `--stdin` | bool | false | Add extra scan roots from stdin when audit runs an internal scan. |
| `--no-content` | bool | false | Exclude file contents from the internal scan. |

### Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success (no issues at or above `--fail-severity`) |
| 1 | Issues at or above `--fail-severity` |
| 2 | Fatal error (invalid input, parse failure, registry error) |

### Stdout/Stderr Behavior

- Output is always written to stdout.
- Errors and progress (when running an internal scan) go to stderr.
- Non-interactive: no prompts; `--input -` reads stdin and must be valid JSON.

---

## Input Sources

`audit` can run in two modes:

1. **From scan JSON**: `--input <file|->`
   - Validates the scan schema before auditing.
   - Uses scan metadata and warnings; content is used only when a rule explicitly requires it.
2. **Inline scan** (default):
   - Runs an internal `scan` using `--repo`, `--repo-only`, and `--stdin` flags.
   - Includes file content by default (use `--no-content` to suppress).
   - Uses the same registry resolution rules as `markdowntown scan`.

When `--input` is provided, scan-related flags are ignored to keep behavior deterministic.

---

## Output Schema (JSON)

### Top-level fields

```json
{
  "schemaVersion": "audit-spec-v1",
  "audit": {
    "toolVersion": "0.0.0",
    "auditStartedAt": 0,
    "generatedAt": 0
  },
  "sourceScan": {
    "schemaVersion": "scan-spec-v1",
    "toolVersion": "0.0.0",
    "registryVersion": "2025-12-01",
    "repoRoot": "/path/to/repo",
    "scanStartedAt": 0,
    "generatedAt": 0,
    "scans": ["/path/to/repo", "~/.codex"]
  },
  "registryVersionUsed": "2025-12-01",
  "pathRedaction": {
    "mode": "auto",
    "enabled": true
  },
  "summary": {
    "issueCounts": {
      "error": 0,
      "warning": 0,
      "info": 0
    },
    "rulesFired": ["MD001", "MD004"]
  },
  "issues": [
    {
      "ruleId": "MD004",
      "severity": "warning",
      "title": "Empty config file",
      "message": "Config file is empty and will be ignored.",
      "suggestion": "Add the intended instructions or delete the file.",
      "fingerprint": "sha256:...",
      "paths": [
        { "path": "./AGENTS.md", "scope": "repo", "redacted": false }
      ],
      "tools": [
        { "toolId": "codex", "kind": "instructions" }
      ],
      "evidence": {
        "warning": "empty"
      }
    }
  ],
  "scanWarnings": []
}
```

### Determinism Rules

- Issues sorted by: severity (**error**, **warning**, **info**) → ruleId → primary path → toolId → kind.
- Paths are redacted for non-repo scopes (see below).
- JSON field order follows struct order (no key sorting).

---

## Issue Object

| Field | Type | Description |
| --- | --- | --- |
| `ruleId` | string | Stable rule identifier (MD001..MD012). |
| `severity` | enum | `error`, `warning`, `info`. |
| `title` | string | Short issue label. |
| `message` | string | Human-readable description. |
| `suggestion` | string | Remediation guidance (no shell commands). |
| `fingerprint` | string | Deterministic hash for stable suppression/diffing. |
| `range` | object | Optional location (1-based line/col) when available. |
| `paths` | array | Affected paths (path objects). |
| `tools` | array | Tool metadata (tool objects). |
| `evidence` | object | Raw scan fields that triggered the rule. |
| `data` | object | Optional UX metadata for diagnostics consumers. |

### Path Object

| Field | Type | Description |
| --- | --- | --- |
| `path` | string | Repo-relative path (`./...`) or redacted placeholder. |
| `scope` | string | `repo`, `user`, or `global`. |
| `redacted` | bool | Whether this path is redacted. |
| `pathId` | string | Stable ID when redacted (e.g., `p:3b7c...`). |

### Tool Object

| Field | Type | Description |
| --- | --- | --- |
| `toolId` | string | Registry toolId. |
| `kind` | string | Registry kind (instructions, config, prompts, rules, skills, agent). |

---

### Data Object (Rule Metadata)

| Field | Type | Description |
| --- | --- | --- |
| `category` | string | UX category (conflict, validity, content, scope, discovery, registry). |
| `docUrl` | string | Documentation link for the rule. |
| `tags` | array | Diagnostic tags (unnecessary, deprecated). |
| `quickFixes` | array | Available quick fix identifiers. |

---

## Path Redaction

- **Repo scope**: paths are repo-root relative with `./` prefix.
- **Non-repo scope** (when `--redact=auto` or `always`):
  - If under home, replace prefix with `$HOME/`.
  - If under XDG config home, replace prefix with `$XDG_CONFIG_HOME/`.
  - Otherwise use deterministic placeholders: `<ABS_PATH_1>`, `<ABS_PATH_2>`, etc.
- **`--redact=never`**: emit raw absolute paths for all scopes.

When a path is redacted, include a stable `pathId` so issues can be correlated without leaking the raw path.

No raw file content is emitted by default.

---

## Markdown Output (`--format md`)

Markdown output is a deterministic report summary with sections:

```text
# markdowntown audit

Summary: 2 errors, 1 warning

## Errors
- [MD001] Config conflict: ./AGENTS.md
  - Suggestion: Keep exactly one config for this tool/kind/scope.

## Warnings
- [MD004] Empty config file: ./AGENTS.md
```

Ordering mirrors JSON ordering rules.

---

## Rule Catalog (v1)

All v1 rules are metadata-only and based on `scan` output fields. `audit` does **not** re-run scan conflict detection; it uses scan warnings when present and falls back to grouping when not.

| Rule ID | Severity | Detection | Suggestion |
| --- | --- | --- | --- |
| `MD000` | error | LSP internal error or registry discovery failure | Check MARKDOWNTOWN_REGISTRY or registry settings. |
| `MD001` | error | Conflicting configs for same `(scope, toolId, kind)` (fallback grouping), or scan conflict warnings when present. Multi-file kinds (`skills`, `prompts`) are excluded. | Keep exactly one config for the tool/kind/scope. |
| `MD002` | warning | `configs[].scope == "repo" && configs[].gitignored == true` | Remove from `.gitignore` or relocate. |
| `MD003` | error | `configs[].frontmatterError != ""` | Fix or remove YAML frontmatter. |
| `MD004` | warning | `configs[].warning == "empty"` **or** `sizeBytes == 0` | Add meaningful content or delete the file. |
| `MD005` | info | No repo configs for a `(toolId, kind)` but user/global configs exist | Add a repo-scoped config for consistent behavior. |
| `MD006` | error/warn | `configs[].error` in (`EACCES`, `ENOENT`, `ERROR`) | Fix permissions or path; repo scope is error, user/global is warning. |
| `MD007` | warning | Duplicate frontmatter identifiers within multi-file kinds (`skills`, `prompts`) | Ensure frontmatter identifiers are unique or consolidate duplicates. |
| `MD008` | warning | `scanWarnings[].code == "CIRCULAR_SYMLINK"` | Break the symlink loop or remove the entry. |
| `MD009` | info | `scanWarnings[].code == "UNRECOGNIZED_STDIN"` | Add a registry pattern or remove the stdin path. |
| `MD010` | warning | `scanWarnings[].code in ("EACCES", "ERROR", "ENOENT")` | Fix permissions or registry paths, then re-run. |
| `MD011` | warning | `configs[].contentSkipped == "binary"` | Replace with a text config or remove the file. |
| `MD012` | warning | Missing required frontmatter identifier for multi-file kinds | Add a required identifier (name/title/id). |
| `MD015` | warning | Unknown `toolId` in frontmatter (fuzzy match suggested) | Replace with a valid toolId from the registry. |

### MD001 conflict fallback

- Group configs by `(scope, toolId, kind)` and emit a conflict when a group has more than one config.
- Exclude known override pairs (e.g., `AGENTS.override.md` + `AGENTS.md`).
- Skip kinds that are expected to be multi-file (`skills`, `prompts`).
- If scan warnings include structured conflict details, prefer them and do not recompute.

### MD007 frontmatter conflict detection

- Applies to multi-file kinds (`skills`, `prompts`) where multiple configs are expected.
- Extract frontmatter identifiers and normalize values (trim + lowercase).
  - `skills`: `name`
  - `prompts`: `name`, `title`, `id`
- Group configs by `(scope, toolId, kind, key, value)` and emit a warning when a group has more than one config.
- Uses frontmatter only; does not read file content.

### MD008-MD010 scan warning mapping

- Map scan warnings to audit issues for visibility in diagnostics.
- Use the warning code/message as evidence and do not duplicate MD001 conflict issues.

### MD011 binary content detection

- Emit when `contentSkipped == "binary"` on a matched config entry.
- No file content is read beyond binary detection.

### MD012 frontmatter identifier requirement

- Applies to multi-file kinds (`skills`, `prompts`).
- Emit when no required identifiers are present in frontmatter.

### MD005 scope awareness

- Only evaluates the scopes present in the scan input. If user/global scope is not scanned, the rule does not fire.
- Emit one issue per `(toolId, kind)` and include detected paths (redacted) plus candidate repo paths from the registry.

### Content Read Policy

- v1 rules never read `content`.
- Future rules that require content must explicitly opt-in and document privacy impact.

---

## Issue Fingerprint

The `fingerprint` field is a deterministic hash to support stable diffs and suppression lists.

Canonical input (sorted):

- `ruleId`
- `severity`
- `paths` (path + scope + pathId)
- `tools` (toolId + kind)
- Selected `evidence` fields (rule-specific, stable keys only)

Hash: `sha256` of the canonical JSON representation.

---

## scanWarnings

`scanWarnings` are included only when `--include-scan-warnings` is set.

- If a warning is already represented by an issue, omit it from `scanWarnings` to avoid duplication.

---

## Error Handling

- Invalid scan JSON or unsupported schema version → fatal error (exit code 2).
- Unknown rule IDs in `--ignore-rule` or `--only` → fatal error (exit code 2).
- When `--input -` is used, empty stdin is a fatal error (exit code 2).

---

## References

- cli/docs/scan-spec-v1.md
- docs/USER_GUIDE.md
- docs/architecture/scan.md
- <https://code.visualstudio.com/docs/copilot/customization/custom-instructions>
- <https://code.visualstudio.com/docs/copilot/customization/prompt-files>
- <https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli>
