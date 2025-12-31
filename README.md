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

Audit scan results:

```bash
markdowntown audit --repo /path/to/repo --repo-only --format md
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
- `markdowntown audit` analyzes scan output and emits JSON/Markdown issues with deterministic ordering.
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

## Repo scope (.github)

Repo scanning is pattern-based from the registry — `markdowntown` does **not** scan every file in `.github`.
For Copilot/VS Code coverage, only specific patterns are matched (e.g., `.github/copilot-instructions.md`,
`.github/instructions/*.instructions.md`, `.github/copilot-instructions/**/*.instructions.md`,
`.github/prompts/*.prompt.md`, `.github/agents/*.md`).

## Copilot + VS Code paths

Repo-scope patterns:

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
- Custom instruction locations configured via `chat.instructionsFilesLocations` should be added via `--stdin`.

## Output highlights

Scan output is deterministic and sorted. Top-level fields include:

- `schemaVersion`, `toolVersion`, `registryVersion`
- `repoRoot`, `scanStartedAt`, `generatedAt`, `timing`
- `scans` (roots) and `configs` (matched files)
- `warnings` (non-fatal issues)

See `docs/USER_GUIDE.md` for detailed output schema and examples.

## Audit highlights

- Supports `--format json|md`, `--input <file|->`, and deterministic ordering.
- Exit codes: 0 when no issues at/above `--fail-severity` (default `error`), 1 when threshold met, 2 for fatal errors.
- Redaction modes via `--redact`; non-repo paths use `$HOME/...`, `$XDG_CONFIG_HOME/...`, or `<ABS_PATH_N>` with a `pathId`.
- Filter rules with `--only`/`--ignore-rule`, exclude paths with `--exclude`, and include scan warnings with `--include-scan-warnings`.

Audit rules surface actionable issues such as empty instructions, frontmatter errors, gitignored configs, missing instructions, and required settings.

## Codex CLI niceties

These files are commonly scanned and may show up in results:

- `AGENTS.md` (Codex agent instructions)
- `.codex/skills/` (skill definitions)
- Codex CLI helpers: `/init`, `/prompts`, `/skills`

## Docs

- `docs/scan-spec-v1.md`
- `docs/architecture/scan.md`
- `docs/audit-spec-v1.md`
- `docs/architecture/audit.md`
- `docs/USER_GUIDE.md`
- `docs/CONTRIBUTING.md`

## Contributing

See `docs/CONTRIBUTING.md` for the full workflow. CI must always be green before merging or releasing changes.
