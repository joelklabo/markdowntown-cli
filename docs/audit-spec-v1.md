# markdowntown audit — v1 Specification

## Overview

**Command**: `markdowntown audit`

`audit` turns a scan inventory into deterministic, actionable issues without modifying files. It is correctness-first: metadata-only by default, explicit about ambiguity, and fail-closed when instruction ordering is undefined.

**Implementation**: Go, rule-driven engine
**First feature**: VS Code + Copilot CLI audit rules, metadata-only

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
| `--ignore-rule` | string[] | (none) | Rule IDs to suppress (repeatable). |
| `--exclude` | string[] | (none) | Path globs to exclude from audit matching (repeatable). |
| `--repo` | path | (auto) | Repo root used when audit runs an internal scan. |
| `--repo-only` | bool | false | Exclude user scope when audit runs an internal scan. |
| `--stdin` | bool | false | Add extra scan roots from stdin when audit runs an internal scan. |

### Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success (no `error`-severity issues) |
| 1 | Completed with `error`-severity issues |
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
   - Uses only scan metadata and warnings; content is ignored unless a rule explicitly requires it.
2. **Inline scan** (default):
   - Runs an internal `scan` using `--repo`, `--repo-only`, and `--stdin` flags.
   - Uses the same registry resolution rules as `markdowntown scan`.

When `--input` is provided, scan-related flags are ignored to keep behavior deterministic.

---

## Output Schema (JSON)

### Top-level fields

```json
{
  "schemaVersion": "1.0",
  "toolVersion": "0.0.0",
  "registryVersion": "1.0",
  "auditStartedAt": 0,
  "generatedAt": 0,
  "input": {
    "repoRoot": "/path/to/repo",
    "scanStartedAt": 0,
    "scanGeneratedAt": 0,
    "scans": ["/path/to/repo", "~/.codex"]
  },
  "summary": {
    "total": 0,
    "error": 0,
    "warn": 0,
    "info": 0
  },
  "issues": [
    {
      "ruleId": "MDTAUDIT001",
      "severity": "warn",
      "title": "Empty instruction file",
      "message": "Instruction file is empty and will be ignored.",
      "suggestion": "Add at least one concrete instruction or delete the file.",
      "paths": ["./AGENTS.md"],
      "tools": ["codex"],
      "evidence": [
        {
          "path": "./AGENTS.md",
          "scope": "repo",
          "sha256": "...",
          "warning": "empty"
        }
      ]
    }
  ]
}
```

### Determinism Rules

- Issues sorted by: severity (`error` > `warn` > `info`) → ruleId → primary path → toolId.
- Paths are redacted for user scope (see below).
- JSON field order follows struct order (no key sorting).

### Path Redaction

- **Repo scope**: paths are repo-root relative with `./` prefix.
- **User scope**: paths are normalized to `~/...` relative to user home.
- **Global scope**: absolute paths are allowed (`/etc/...`).

No raw file content is emitted by default.

---

## Markdown Output (`--format md`)

Markdown output is a deterministic report summary with sections:

```text
# markdowntown audit

Summary: 2 errors, 1 warn

## Errors
- [MDTAUDIT002] Frontmatter parse error in ./AGENTS.md
  - Suggestion: Fix YAML frontmatter or remove it.

## Warnings
- [MDTAUDIT001] Empty instruction file: ./AGENTS.md
```

Ordering mirrors JSON ordering rules.

---

## Rule Catalog (v1)

All v1 rules are metadata-only and based on `scan` output fields. `audit` does **not** recompute scan warnings; it only consumes them.

| Rule ID | Severity | Detection | Suggestion |
| --- | --- | --- | --- |
| `MDTAUDIT001` | warn | `configs[].warning == "empty"` | Add a meaningful instruction or remove the file. |
| `MDTAUDIT002` | error | `configs[].frontmatterError != ""` | Fix or remove YAML frontmatter. |
| `MDTAUDIT003` | warn | `configs[].gitignored == true` in repo scope | Remove from `.gitignore` or relocate the file. |
| `MDTAUDIT004` | error | `configs[].error` in (`EACCES`, `ENOENT`, `ERROR`) | Fix file permissions or path so audit can read it. |
| `MDTAUDIT005` | warn | Multiple VS Code/Copilot instruction types present in repo (`.github/copilot-instructions.md` and `.github/instructions/**`) | Consolidate instructions to a single mechanism to avoid undefined ordering. |

### Content Read Policy

- v1 rules never read `content`.
- Future rules that require content must explicitly opt-in and document privacy impact.

---

## Error Handling

- Invalid scan JSON or unsupported schema version → fatal error (exit code 2).
- Unknown rule IDs in `--ignore-rule` → fatal error (exit code 2).
- When `--input -` is used, empty stdin is a fatal error (exit code 2).

---

## References

- docs/scan-spec-v1.md
- docs/USER_GUIDE.md
- docs/architecture/scan.md
