# markdowntown-cli

Deterministic scanning for AI tool configuration files. `markdowntown` walks repo and user scopes, matches a registry of known config patterns, and emits stable JSON output for audits and CI.

## Install

Homebrew (if available):

```bash
brew install markdowntown
brew uninstall markdowntown
```

Build from source:

```bash
go build -o bin/markdowntown ./cmd/markdowntown
```

Or install into your Go bin:

```bash
go install ./cmd/markdowntown
```

Uninstall (Go install):

```bash
rm "$(go env GOPATH)/bin/markdowntown"
```

## Quick start

```bash
markdowntown scan --repo /path/to/repo --repo-only
```

Compact JSON output:

```bash
markdowntown scan --compact
```

Generate evidence-backed suggestions (Markdown output):

```bash
markdowntown suggest --client codex --format md
```

Resolve effective instruction chains:

```bash
markdowntown resolve --client codex --repo /path/to/repo
```

Audit conflicts and omissions:

```bash
markdowntown audit --client codex --format json
```

Validate the registry:

```bash
markdowntown registry validate
```

List supported tools:

```bash
markdowntown tools list
```

## Screenshot

![Scan output](docs/screenshots/scan-cli/scan-output.png)

## Commands

- `markdowntown scan` scans repo + user roots and emits JSON.
- `markdowntown suggest` emits evidence-backed instruction suggestions.
- `markdowntown resolve` lists the effective instruction chain for a target file.
- `markdowntown audit` reports conflicts and omissions without suggestions.
- `markdowntown registry validate` validates the registry JSON (syntax, schema, unique IDs, docs reachability). Exits 1 on failure.
- `markdowntown tools list` emits a JSON array of tools aggregated from the registry.
- `markdowntown --version` prints tool + schema versions.

Run `markdowntown <command> --help` for full flag details.

## Evidence-only suggestions

`suggest` and `audit` are correctness-first: suggestions are emitted only when Tier-0/Tier-1 sources and proof objects are present. Conflicts or missing evidence produce omissions (see `audit`). Use `--explain` to include proof metadata in JSON output.

`--offline` skips all network fetches and returns warnings if no cached data is available. `--refresh` forces a refresh when caching is supported (current runs always fetch unless `--offline` is set).

Example (Markdown output):

```md
# Suggestions (codex)

- Keep instructions short and self-contained.
  - Sources: https://example.com/docs
```

## Registry discovery

Registry resolution order:

1. `MARKDOWNTOWN_REGISTRY` (explicit file path)
2. `$XDG_CONFIG_HOME/markdowntown/ai-config-patterns.json` (or `~/.config/markdowntown/ai-config-patterns.json`)
3. `/etc/markdowntown/ai-config-patterns.json`
4. `ai-config-patterns.json` next to the executable

If multiple registries are found without an override, the scan fails.

Release archives include `ai-config-patterns.json` next to the binary; keep them together or copy the registry into the XDG config path.

## Suggestion source registry

Suggestion sources are defined in `doc-sources.json` and discovered in this order:

1. `MARKDOWNTOWN_SOURCES` (explicit file path)
2. `$XDG_CONFIG_HOME/markdowntown/doc-sources.json` (or `~/.config/markdowntown/doc-sources.json`)
3. `/etc/markdowntown/doc-sources.json`
4. `doc-sources.json` next to the executable

If multiple source registries are found without an override, the command fails.

Release archives include `doc-sources.json` next to the binary; keep it co-located or move it into the XDG config path.

## Config + cache locations

Suggestion data and cache paths follow the XDG base directory spec:

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

## Output highlights

Scan output is deterministic and sorted. Top-level fields include:

- `schemaVersion`, `toolVersion`, `registryVersion`
- `repoRoot`, `scanStartedAt`, `generatedAt`, `timing`
- `scans` (roots) and `configs` (matched files)
- `warnings` (non-fatal issues)

See `docs/USER_GUIDE.md` for detailed output schema and examples.

## Codex CLI niceties

These files are commonly scanned and may show up in results:

- `AGENTS.md` (Codex agent instructions)
- `.codex/skills/` (skill definitions)
- Codex CLI helpers: `/init`, `/prompts`, `/skills`

## Docs

- `docs/scan-spec-v1.md`
- `docs/architecture/scan.md`
- `docs/USER_GUIDE.md`
- `docs/CONTRIBUTING.md`

## Contributing

See `docs/CONTRIBUTING.md` for the full workflow. CI must always be green before merging or releasing changes.
