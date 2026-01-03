# markdowntown scan-only v1 plan

## Goal
Ship a single CLI command that inventories AI tooling config/instruction files and outputs deterministic JSON. No validation, no diffing, no watch mode, no templates.

## Non-goals (explicitly out of scope for v1)
- Additional commands (diff, validate, doctor, init, migrate, watch, serve, completion).
- Non-JSON formats (markdown, summary, JSONL streaming).
- Content rendering or transformation.
- Repo cloning / remote scanning.

## Command
```text
markdowntown scan [flags]
```

### Flags (v1)
- `--repo <path>`: explicit repo root (default: git root from cwd if available).
- `--include-user`: include user-scope roots (off by default).
- `--user-only`: scan user roots only; does not require git.
- `--no-gitignore`: skip gitignore checks (faster, avoids git dependency).
- `--compact`: minified JSON output.
- `--output <path>`: write JSON to file instead of stdout.
- `--quiet`: suppress progress; JSON only to stdout.

### Exit codes (v1)
- `0`: success (may include warnings).
- `1`: fatal error (invalid registry, unreadable repo root).

## Scope and defaults
- Default scope: repo only.
- User scope is opt-in (`--include-user` or `--user-only`).
- Global/system scope is not supported in v1.

## Git behavior (no hard requirement)
- Git is optional.
- If repo scope is requested and git is available, use it for repo root discovery and gitignore checks.
- If git is not available:
  - repo root must be provided with `--repo`.
  - `gitignored` is `null` for repo files (or omitted if `--no-gitignore`).
- `--user-only` does not require git at all.

## Pattern registry (updatable, layered)
Registry is JSON and is the single source of truth for patterns.

### Load order (low -> high precedence)
1. Bundled registry shipped with the binary (default).
2. System override: `/etc/markdowntown/ai-config-patterns.json` (if present).
3. User override: `~/.config/markdowntown/ai-config-patterns.json` (if present).
4. Explicit override: `MARKDOWNTOWN_REGISTRY=/path/to/file` (replaces all).

Merging rules:
- Same `id` overrides previous entry.
- New `id` entries are appended.
- Registry version is taken from the highest-precedence file.

### Registry format (v1)
```json
{
  "version": "1.0",
  "patterns": [
    {
      "id": "github-copilot-instructions",
      "toolId": "github-copilot",
      "toolName": "GitHub Copilot",
      "kind": "instructions",
      "scope": "repo",
      "paths": [".github/copilot-instructions.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://docs.github.com/..."],
      "notes": "Requires VS Code setting to apply",
      "hints": [
        {"type": "requires-setting", "setting": "github.copilot.chat.codeGeneration.useInstructionFiles"}
      ]
    }
  ]
}
```

### Validation rules (v1)
- Strict JSON only.
- `docs` is required for every pattern (official docs only).
- Invalid regex or unknown enum value fails the run (exit code 1).

## Pattern matching rules
- Patterns match against full paths relative to each scan root.
- Default type: glob (`*`, `**`, `?`).
- Regex allowed only when `type: "regex"` is set.
- Case sensitivity follows OS conventions:
  - Windows and default macOS filesystems: case-insensitive.
  - Linux: case-sensitive.

## Symlink policy (safe by default)
- Do not follow symlinks.
- If a matched path is a symlink, include `symlinkTarget` (resolved path) but do not read or hash the target.
- No external target traversal in v1.

## User-scope roots (v1)
Only scanned when `--include-user` or `--user-only` is set.

- `~/.codex`
- `~/.config/Code/User`
- `~/.gemini`
- `~/Documents/Cline/Rules`
- `~/.continue`
- `~/.cursor`
- `~/.claude`

Note: Windows-specific user roots are future work; v1 focuses on macOS/Linux paths only.

## Scanning behavior
- Walk only within specified scan roots.
- Ignore `.git/` directory.
- Submodules: do not enter submodule directories.
- No stdin path expansion in v1.
- No content inclusion in v1; only metadata.

## Output schema (v1)
```json
{
  "schemaVersion": "1.0.0",
  "registryVersion": "1.0",
  "toolVersion": "0.1.0",
  "generatedAt": 1735561235123,
  "repoRoot": "/path/to/repo",
  "scans": [
    {"scope": "repo", "root": "/path/to/repo", "exists": true, "gitAvailable": true},
    {"scope": "user", "root": "/Users/me/.gemini", "exists": true, "gitAvailable": false}
  ],
  "configs": [
    {
      "path": "/path/to/repo/.github/copilot-instructions.md",
      "scope": "repo",
      "depth": 0,
      "sizeBytes": 1240,
      "sha256": "...",
      "mtime": 1735500000000,
      "gitignored": false,
      "symlinkTarget": null,
      "tools": [
        {
          "patternId": "github-copilot-instructions",
          "toolId": "github-copilot",
          "toolName": "GitHub Copilot",
          "kind": "instructions",
          "loadBehavior": "single",
          "application": "automatic",
          "matchedPattern": ".github/copilot-instructions.md",
          "notes": "Requires VS Code setting to apply"
        }
      ]
    }
  ],
  "warnings": []
}
```

### Output rules
- Deterministic ordering: scope (repo < user) then depth then path.
- `gitignored` is null when git is unavailable or `--no-gitignore` is set.
- `sha256` is null if file read fails.

## Warnings (v1)
- Permission errors reading file metadata or content.
- Registry merge overrides (same id overridden by higher precedence file).
- Circular symlink detected (if resolution fails).

## Tests (v1)
- Registry load precedence and override behavior.
- Pattern matching for glob and regex.
- Deterministic sorting.
- Repo-only scan without git (with `--repo`).
- User-only scan without git.
- Symlink handling (no follow, target recorded).
- Gitignore presence vs `--no-gitignore` behavior.
- Case sensitivity on simulated Windows vs Linux path sets.

## Acceptance criteria (v1)
- `markdowntown scan` produces deterministic JSON for all registered patterns.
- Registry is external and layered with predictable precedence.
- No additional commands or output formats are required for v1.
- Default behavior scans repo only; user scope is opt-in.
- Git is optional; repo scanning works with `--repo` when git is absent.
