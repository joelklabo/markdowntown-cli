# Markdowntown CLI User Guide

## Overview

`markdowntown` scans for AI tool configuration files using a registry of known patterns and emits deterministic JSON suitable for audits, CI, and onboarding.

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

## Developer notes

See `docs/CONTRIBUTING.md` for workflow setup, screenshot generation, and fuzzing guidance.
