# Markdowntown CLI User Guide

## Overview

`markdowntown` scans for AI tool configuration files and can generate evidence-backed instruction suggestions plus resolve effective instruction chains for supported clients.

## Install / Uninstall

Homebrew (if available):

```bash
brew install markdowntown
brew uninstall markdowntown
```

Go install:

```bash
go install ./cmd/markdowntown
```

Uninstall (Go install):

```bash
rm "$(go env GOPATH)/bin/markdowntown"
```

## Commands

### `markdowntown scan`

```bash
markdowntown scan [flags]
```

Flags:

- `--repo <path>`: repo path (defaults to git root from cwd)
- `--repo-only`: exclude user scope (scan repo only)
- `--stdin`: read additional paths from stdin (one per line)
- `--no-content`: exclude file contents from output
- `--compact`: emit compact JSON (no indentation)
- `--quiet`: disable progress output
- `--for-file <path>`: filter output to configs applicable to path (e.g. `src/app.ts`)

Notes:

- Progress updates stream to stderr when stdout is a TTY and `--quiet` is not set.
- Exit code is 0 for success (even with warnings) and 1 for fatal errors.

Examples:

```bash
markdowntown scan --repo /path/to/repo --repo-only
markdowntown scan --stdin < extra-paths.txt
markdowntown scan --no-content --compact
```

### `markdowntown scan-remote`

Clone and scan a remote git repository.

```bash
markdowntown scan-remote <url> [flags]
```

Flags:

- `--ref <ref>`: git reference (branch, tag, commit) to checkout
- `--repo-only`: exclude user scope (scan repo only)
- `--include-content`: include file contents in output (default)
- `--no-content`: exclude file contents from output
- `--compact`: emit compact JSON (no indentation)
- `--quiet`: disable progress output

Notes:

- Clones the repository to a temporary directory, scans it, then removes the directory.
- Use with `--no-content` for large repositories if content is not needed, but be aware that audit might require content.

Examples:

```bash
markdowntown scan-remote https://github.com/example/repo
markdowntown scan-remote https://github.com/example/repo --ref v1.0.0
```

### `markdowntown audit`

```bash
markdowntown audit [flags]
```

Flags:

- `--input <path|->`: read scan JSON from file or stdin
- `--format <json|md>`: output format (default: json)
- `--compact`: emit compact JSON (no indentation; ignored for md)
- `--fail-severity <level>`: exit 1 when issues meet severity (`error|warning|info`)
- `--redact <mode>`: path redaction mode (`auto|always|never`)
- `--only <id>`: run only these rule IDs (repeatable)
- `--ignore-rule <id>`: exclude specific rules from running (by ID)
- `--exclude <glob>`: exclude specific file paths from being audited
- `--include-scan-warnings`: include raw scan warnings in output
- `--repo <path>`: repo path (defaults to git root from cwd; internal scan only)
- `--repo-only`: exclude user scope (scan repo only)
- `--stdin`: read additional paths from stdin (one per line)
- `--no-content`: exclude file contents from internal scan

Notes:

- Exit codes: 0 when no issues at/above `--fail-severity` (default `error`), 1 when threshold met, 2 for fatal errors.
- Repo-scope paths are emitted as `./...`.
- Non-repo paths are redacted with precedence: `$XDG_CONFIG_HOME` > `$HOME` > `<ABS_PATH_N>` (deterministic per run).
- `--input` cannot be combined with scan flags (`--repo`, `--repo-only`, `--stdin`).
- Audit reads file contents by default when running an internal scan (content is not emitted in audit output).

Examples:

```bash
markdowntown audit --repo /path/to/repo --repo-only --format md
markdowntown audit --input scan.json --fail-severity warning
```

### `markdowntown suggest`

Generates evidence-backed suggestions for a specific client.

```bash
markdowntown suggest [flags]
```

Flags:

- `--client <codex|copilot|vscode|claude|gemini>`: client target (default `codex`)
- `--format <json|md>`: output format (default `json`)
- `--json`: alias for `--format json`
- `--refresh`: force refresh of sources
- `--offline`: do not fetch; use cached data only
- `--explain`: include proof objects in output

Notes:

- Suggestions are fail-closed: only Tier-0/Tier-1 sources with proof objects produce suggestions.
- `--explain` populates `proof` metadata (sources, snapshot IDs, spans, normative strength). Without it, `proof` is blanked.
- `--offline` disables network fetches and uses cached snapshots under the XDG data path; warnings are emitted for cache misses.
- `--refresh` forces a re-fetch by ignoring cached metadata.

Examples:

```bash
markdowntown suggest --client codex --format md
markdowntown suggest --client codex --format json --explain
```

### `markdowntown resolve`

Resolves the effective instruction chain for a client and target path.

```bash
markdowntown resolve [flags]
```

Flags:

- `--client <codex|copilot|vscode|claude|gemini>`: client target (default `codex`)
- `--format <json|md>`: output format (default `json`)
- `--json`: alias for `--format json`
- `--repo <path>`: repo root (defaults to git root)
- `--path <file>`: target file path (used for path-scoped instructions)
- `--setting <key>`: enable a client setting (repeatable)

Notes:

- VS Code resolution requires settings flags to mirror the editor state. Known keys:
  - `github.copilot.chat.codeGeneration.useInstructionFiles`
  - `chat.useAgentsMdFile`
  - `chat.useNestedAgentsMdFiles`
- `resolve` may report conflicts when instruction order is undefined.

Examples:

```bash
markdowntown resolve --client codex --repo /path/to/repo
markdowntown resolve --client vscode --repo /path/to/repo --path src/app.ts \
  --setting github.copilot.chat.codeGeneration.useInstructionFiles \
  --setting chat.useAgentsMdFile
```

### `markdowntown audit`

Reports conflicts and omissions without emitting suggestions.

```bash
markdowntown audit [flags]
```

Flags:

- `--client <codex|copilot|vscode|claude|gemini>`: client target (default `codex`)
- `--format <json|md>`: output format (default `json`)
- `--json`: alias for `--format json`
- `--refresh`: force refresh of sources
- `--offline`: do not fetch; use cached data only
- `--explain`: include proof objects in output

Examples:

```bash
markdowntown audit --client codex --format json
```

### `markdowntown registry validate`

Validates the registry JSON and reports details for each check.

```bash
markdowntown registry validate
```

- Exits 1 if validation fails.
- Includes a `docsReachable` check which makes HTTP requests; allow network access when running this command.

### `markdowntown tools list`

Aggregates registry patterns into a tool summary list.

```bash
markdowntown tools list
```

## Registry discovery

Registry resolution order:

1. `MARKDOWNTOWN_REGISTRY` (explicit file path)
2. `$XDG_CONFIG_HOME/markdowntown/ai-config-patterns.json` (or `~/.config/markdowntown/ai-config-patterns.json`)
3. `/etc/markdowntown/ai-config-patterns.json`
4. `ai-config-patterns.json` next to the executable

If multiple registries are found without an override, the scan fails.

## Suggestion source registry

Suggestion sources are defined in `doc-sources.json` and discovered in this order:

1. `MARKDOWNTOWN_SOURCES` (explicit file path)
2. `$XDG_CONFIG_HOME/markdowntown/doc-sources.json` (or `~/.config/markdowntown/doc-sources.json`)
3. `/etc/markdowntown/doc-sources.json`
4. `doc-sources.json` next to the executable

If multiple source registries are found without an override, the command fails.

See `docs/source-registry.md` for schema details and tier guidance.

## Config + cache locations

Suggestion paths follow the XDG base directory spec:

- Config: `$XDG_CONFIG_HOME/markdowntown` (or `~/.config/markdowntown`)
- Cache: `$XDG_CACHE_HOME/markdowntown` (or `~/.cache/markdowntown`)
- Data: `$XDG_DATA_HOME/markdowntown` (or `~/.local/share/markdowntown`)

Suggested cache layout:

- Metadata: `$XDG_CACHE_HOME/markdowntown/suggest/metadata.json`
- Snapshots: `$XDG_DATA_HOME/markdowntown/suggest/snapshots/*.body`

## User-scope roots

Default user roots scanned (unless `--repo-only` is set):

- `CODEX_HOME` (defaults to `~/.codex`)
- `~/.config/Code/User`
- `~/.gemini`
- `~/Documents/Cline/Rules`
- `~/.continue`
- `~/.cursor`
- `~/.claude`

## Copilot + VS Code paths

Repo-scope patterns (pattern-based; `.github` is **not** fully scanned):

- `.github/copilot-instructions.md`
- `.github/copilot-instructions/**/*.instructions.md`
- `.github/instructions/*.instructions.md`
- `.github/prompts/*.prompt.md`
- `.github/agents/*.md`
- `AGENTS.md`

User-scope patterns:

- `~/.copilot/config.json`
- `~/.copilot/mcp-config.json`
- `$XDG_CONFIG_HOME/copilot/config.json`
- `$XDG_CONFIG_HOME/copilot/mcp-config.json`
- `~/.copilot/agents/*.md`
- `~/.config/Code/User/prompts/*.prompt.md`
- `~/.config/Code/User/profiles/*/prompts/*.prompt.md`

Notes:

- VS Code instruction files require settings such as `github.copilot.chat.codeGeneration.useInstructionFiles`,
  `chat.useAgentsMdFile`, and `chat.useNestedAgentsMdFiles`.
- Ordering is undefined when multiple instruction types coexist; treat conflicts as ambiguous.
- If you configure `chat.instructionsFilesLocations`, pass those custom paths via `--stdin`.

## Codex CLI niceties

Codex users commonly store instructions and skill definitions in:

- `AGENTS.md`
- `.codex/skills/`

Codex CLI helpers like `/init`, `/prompts`, and `/skills` often interact with these files and directories.

## Output schema

Top-level output fields:

- `schemaVersion`: output schema version
- `registryVersion`: registry JSON version
- `toolVersion`: CLI version
- `scanStartedAt`, `generatedAt`: unix epoch milliseconds
- `timing`: scan timing metrics
- `repoRoot`: resolved repo root
- `scans`: list of scanned roots with scope and existence
- `configs`: matched config entries
- `warnings`: non-fatal warnings

`configs` entry fields (selected):

- `path`, `scope`, `depth`
- `sizeBytes`, `sha256`, `mtime`
- `gitignored` (via `git check-ignore`)
- `frontmatter`, `frontmatterError`
- `content`, `contentSkipped`
- `error`, `warning`
- `tools` (tool metadata for each match)

`tools list` output fields:

- `toolId`, `toolName`, `patternCount`, `docs`

Warnings are not fatal; examples include `CONFIG_CONFLICT`, `CIRCULAR_SYMLINK`, and `UNRECOGNIZED_STDIN`.

## Audit output schema

Top-level audit fields:

- `schemaVersion` (audit schema version tag)
- `audit` (toolVersion, auditStartedAt, generatedAt)
- `sourceScan` (schemaVersion, toolVersion, registryVersion, repoRoot, scanStartedAt, generatedAt, scans)
- `registryVersionUsed`
- `pathRedaction` (mode, enabled)
- `summary` (issueCounts, rulesFired)
- `issues` (ruleId, severity, title, message, suggestion, fingerprint, paths, tools, evidence)
- `scanWarnings` (optional; included only with `--include-scan-warnings`)

`paths` fields include `path`, `scope`, `redacted`, and optional `pathId` for redacted entries.

Markdown output groups issues by severity and includes suggestions.

## Suggest output fields

- `client`, `generatedAt`
- `suggestions`
- `conflicts`, `omissions`, `warnings`

Each suggestion includes `id`, `claimId`, `text`, `sources`, and `proof` (when `--explain` is set).

## Resolve output fields

- `client`, `generatedAt`
- `resolution` (applied files, order guarantee, conflicts, settingsRequired, warnings)

## Example output (abbreviated)

```json
{
  "schemaVersion": "1.0.0",
  "registryVersion": "2025-01-01",
  "toolVersion": "0.1.0",
  "scanStartedAt": 0,
  "generatedAt": 0,
  "timing": {
    "discoveryMs": 0,
    "hashingMs": 0,
    "gitignoreMs": 0,
    "totalMs": 0
  },
  "repoRoot": "/path/to/repo",
  "scans": [
    {"scope": "repo", "root": "/path/to/repo", "exists": true},
    {"scope": "user", "root": "/home/user/.codex", "exists": true}
  ],
  "configs": [
    {
      "path": "/path/to/repo/AGENTS.md",
      "scope": "repo",
      "depth": 1,
      "sizeBytes": 1234,
      "sha256": "abc123",
      "mtime": 0,
      "gitignored": false,
      "frontmatter": {},
      "tools": [
        {
          "toolId": "codex",
          "toolName": "OpenAI Codex",
          "kind": "instructions",
          "loadBehavior": "auto",
          "application": "codex",
          "matchedPattern": "repo-agents",
          "notes": "",
          "hints": []
        }
      ]
    }
  ],
  "warnings": []
}
```

### Suggest output (abbreviated)

```json
{
  "client": "codex",
  "generatedAt": 0,
  "suggestions": [
    {
      "id": "suggest:sha256:...",
      "claimId": "source:sha256:...",
      "client": "codex",
      "text": "Keep instructions short and self-contained.",
      "sources": ["https://example.com/docs"],
      "proof": {
        "sources": ["https://example.com/docs"],
        "snapshotIds": ["sha256:..."],
        "spans": [{"sectionId": "section-1", "start": 0, "end": 42}],
        "normativeStrength": "SHOULD"
      }
    }
  ],
  "conflicts": [],
  "omissions": [],
  "warnings": []
}
```

## Developer notes

See `docs/CONTRIBUTING.md` for workflow setup, screenshot generation, and fuzzing guidance.
