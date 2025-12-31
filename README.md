# markdowntown-cli

Deterministic scanning for AI tool configuration files. `markdowntown` walks repo and user scopes, matches a registry of known config patterns, and emits stable JSON output for audits and CI.

## Install

Build from source:

```bash
go build -o bin/markdowntown ./cmd/markdowntown
```

Or install into your Go bin:

```bash
go install ./cmd/markdowntown
```

## Quick start

```bash
markdowntown scan --repo /path/to/repo --repo-only
```

Compact JSON output:

```bash
markdowntown scan --compact
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
- `markdowntown registry validate` validates the registry JSON (syntax, schema, unique IDs, docs reachability). Exits 1 on failure.
- `markdowntown tools list` emits a JSON array of tools aggregated from the registry.
- `markdowntown --version` prints tool + schema versions.

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
