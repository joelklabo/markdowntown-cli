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
- `--include-content`: include file contents in output (use with care for secrets)
- `--compact`: emit compact JSON (no indentation)
- `--quiet`: disable progress output

Notes:

- Progress updates stream to stderr when stdout is a TTY and `--quiet` is not set.
- Exit code is 0 for success (even with warnings) and 1 for fatal errors.

Examples:

```bash
markdowntown scan --repo /path/to/repo --repo-only
markdowntown scan --stdin < extra-paths.txt
markdowntown scan --include-content --compact
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
- `--offline` disables network fetches; current releases return warnings when no cached data exists.
- `--refresh` forces a re-fetch when caching is supported (current runs fetch by default).

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

## Config + cache locations

Suggestion paths follow the XDG base directory spec:

- Config: `$XDG_CONFIG_HOME/markdowntown` (or `~/.config/markdowntown`)
- Cache: `$XDG_CACHE_HOME/markdowntown` (or `~/.cache/markdowntown`)
- Data: `$XDG_DATA_HOME/markdowntown` (or `~/.local/share/markdowntown`)

Current releases keep evidence in memory per run; on-disk caches will live in the cache/data locations above.

## User-scope roots

Default user roots scanned (unless `--repo-only` is set):

- `CODEX_HOME` (defaults to `~/.codex`)
- `~/.config/Code/User`
- `~/.gemini`
- `~/Documents/Cline/Rules`
- `~/.continue`
- `~/.cursor`
- `~/.claude`

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

Suggest/audit output fields:

- `client`, `generatedAt`
- `suggestions` (omitted for `audit`)
- `conflicts`, `omissions`, `warnings`

Each suggestion includes `id`, `claimId`, `text`, `sources`, and `proof` (when `--explain` is set).

Resolve output fields:

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
