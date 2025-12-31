# markdowntown suggest/resolve/audit — v1 Specification

## Overview

**Commands**:
- `markdowntown suggest`
- `markdowntown resolve`
- `markdowntown audit`

This spec defines a correctness-first, evidence-only workflow that distills authoritative documentation into suggestions for agent instruction files. The pipeline is built-in and invisible to end users; outputs are deterministic, source-linked, and fail-closed when evidence is missing or conflicting.

## Primary user case (v1)

A developer or platform engineer runs `markdowntown suggest` from a repo and receives **deterministic, source-backed** guidance on improving agent instruction files for a target client (Codex first, extensible to Copilot/VS Code/Claude/Gemini). Suggestions are omitted when evidence is ambiguous, missing, or conflicting.

## Non-goals (v1)
- No MCP server or background daemon.
- No inference beyond explicit documentation statements.
- No telemetry or analytics collection.
- No private/authenticated sources.

---

## CLI Interface

### Commands

```text
markdowntown suggest [flags]   # Produce evidence-only suggestions
markdowntown resolve [flags]   # Show effective instruction chain for a target file
markdowntown audit [flags]     # Report conflicts/omissions and source coverage
```

### Common flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--client` | string | `codex` | Target client: `codex`, `copilot`, `vscode`, `claude`, `gemini`. |
| `--repo` | path | (auto) | Repo root. Defaults to git root from cwd. |
| `--format` | string | `json` | Output format: `json` or `md`. |
| `--json` | bool | false | Alias for `--format json`. |
| `--refresh` | bool | false | Force refresh of cached sources (still conditional GET). |
| `--offline` | bool | false | Disallow network access; use cached snapshots only. |
| `--explain` | bool | false | Include proof metadata in JSON output (no raw spans). |
| `-h, --help` | bool | false | Show help. |

### `resolve` flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--path` | path | (required) | Target file path to resolve effective instruction chain. |

### Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success (even with warnings or omissions) |
| 1 | Fatal error (invalid args, missing repo, invalid registry, cache corruption) |

### Stdout/Stderr

- **Stdout**: command outputs (JSON or Markdown).
- **Stderr**: diagnostics, warnings, and progress (TTY only).
- No interactive prompts; use flags for all behaviors.

---

## Evidence-Only Rules

1. Suggestions are **invalid** unless every claim has at least one Tier-0/Tier-1 source reference.
2. If authoritative sources conflict or ordering is undefined, the CLI **omits suggestions** and emits conflict records.
3. Suggestions include **source links**; proof metadata is only present in JSON when `--explain` is set.

### Proof Object (internal, JSON output only)
- `sources[]`: URLs
- `snapshotIds[]`: immutable snapshot IDs
- `spans[]`: internal anchors to extracted text (not displayed)
- `normativeStrength`: `must`, `should`, `may`, `info`
- `conflictsWith[]`: conflicting claim IDs

---

## Config Precedence & Locations

### Precedence
1. CLI flags
2. Environment variables
3. Project config
4. User config
5. System config

### Locations (XDG)
- Config: `$XDG_CONFIG_HOME/markdowntown/config.toml` (fallback `~/.config/markdowntown/config.toml`)
- Cache: `$XDG_CACHE_HOME/markdowntown/` (fallback `~/.cache/markdowntown/`)
- Data: `$XDG_DATA_HOME/markdowntown/` (fallback `~/.local/share/markdowntown/`)

**Registry overrides**:
- `MARKDOWNTOWN_SOURCES` may point to an alternate source registry file.

---

## Refresh & Caching

- Default refresh interval: **24 hours** per source.
- `--refresh` forces conditional fetches.
- `--offline` disallows network access and uses last verified snapshots.
- Robots.txt is honored; disallowed sources produce audit warnings and are excluded.

---

## Output Schema (JSON)

```json
{
  "schemaVersion": "suggest-1.0",
  "toolVersion": "0.1.0",
  "generatedAt": 0,
  "client": "codex",
  "repoRoot": "/path/to/repo",
  "mode": "suggest",
  "suggestions": [
    {
      "id": "codex-001",
      "title": "Use AGENTS.override.md for repo-specific overrides",
      "severity": "info",
      "body": "...",
      "sourceIds": ["src-1"],
      "proof": { "sources": [], "snapshotIds": [], "spans": [], "normativeStrength": "must", "conflictsWith": [] }
    }
  ],
  "conflicts": [
    { "id": "conf-1", "reason": "Undefined merge order", "sourceIds": ["src-2"] }
  ],
  "omissions": [
    { "id": "omit-1", "reason": "Missing Tier-0/1 evidence" }
  ],
  "sources": [
    { "id": "src-1", "url": "https://...", "tier": "tier-0", "lastVerifiedAt": 0 }
  ],
  "warnings": ["..."],
  "timing": { "fetchMs": 0, "totalMs": 0 }
}
```

### Markdown Output
- Human-readable suggestions only.
- Includes source links.
- No proof metadata or extraction spans.

---

## Failure & Warning Handling

- Invalid registry or config is fatal.
- Fetch failures are warnings unless they block all Tier-0/1 sources for a client.
- Conflict records are emitted in `audit` and `suggest` JSON output; Markdown summarizes conflicts without proof metadata.

---

## Security Notes

- Only HTTPS sources are fetched; redirects to non-HTTPS or non-allowlisted hosts are rejected.
- Source registry hosts are strict hostnames (no schemes/paths); source URLs must be allowlisted and path-safe.
- The CLI never accepts secrets via flags. Future authenticated sources must use environment variables or files.
- Cache and snapshot paths must be sanitized to prevent traversal (derive paths from hashed URLs, not raw input).

---

## Client Coverage (v1)

- Codex (primary)
- Copilot + VS Code
- Claude Code
- Gemini CLI

The adapter contract and conflict policy are specified in `docs/architecture/instruction-adapters.md`.
