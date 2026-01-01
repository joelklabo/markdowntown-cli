# markdowntown scan — v1 Specification

## Overview

**Command**: `markdowntown scan`

A CLI tool that inventories AI coding tool configuration and instruction files across repo and user scopes, producing deterministic JSON output suitable for programmatic consumption.

**Implementation**: Go with parallel I/O
**First feature**: This is a greenfield project; spec includes scaffolding.

## Primary user case (v1)

A developer or platform engineer runs `markdowntown scan` from a repo and wants a **deterministic JSON inventory** of AI tool configs (repo + user scope) for audits, CI checks, or onboarding. The output must be machine-friendly, stable across runs, and capture Codex/Copilot/Claude/etc. instruction files without requiring any tool-specific setup or network access.

## Codex CLI niceties (v1)

- Detect Codex instruction precedence (`AGENTS.override.md` over `AGENTS.md` per directory).
- Recognize Codex skills and prompts locations.
- Document helpful slash commands (`/init`, `/prompts`, `/skills`) for local workflow, without affecting scan behavior.

---

## CLI Interface

### Commands

```text
markdowntown                     # Show help (no default command)
markdowntown scan [flags]        # Scan for AI config files
markdowntown registry validate   # Validate pattern registry
markdowntown tools list          # List recognized tools
```

### scan Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--repo` | path | (auto) | Explicit repo root. Required if not in a git repo. |
| `--repo-only` | bool | false | Exclude user scope; scan repo only. |
| `-q`, `--quiet` | bool | false | Suppress progress output; JSON only to stdout. |
| `--include-content` | bool | true | Include file contents in output (default). |
| `--no-content` | bool | false | Exclude file contents from output. |
| `--stdin` | bool | false | Read additional paths from stdin (one per line). |
| `--compact` | bool | false | Output minified JSON instead of pretty-printed. |
| `--version` | bool | - | Output `markdowntown X.Y.Z (schema A.B.C)` |

### Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success (even with warnings) |
| 1 | Fatal error |

### Progress Output

When not in quiet mode and stdout is a TTY, display live progress to stderr:

```text
Scanning .../src/components/Button.tsx
Found 12 configs
```

Progress shows current path being scanned (full path, left-truncated to fit terminal width). Auto-disabled in non-TTY environments (CI, pipes).

---

## Scanning Behavior

### Git Requirement

Git is a **hard prerequisite**. The tool requires git to be installed for:
- Repo root detection
- Gitignore checking via `git check-ignore`
- Future git-related features

Exit with error if git is not available.

### Repo Root Detection

- Find git root from cwd using `git rev-parse --show-toplevel`
- Error if not in a git repo and `--repo` not provided
- `--repo <path>` overrides detection **but must resolve to a git work tree**; error if not

### Scope Definitions

| Scope | Description |
| --- | --- |
| `repo` | Files within the git repository |
| `user` | Files in user home directories (`~/.tool/`) |
| `global` | System-wide configs (`/etc/`) - reserved for future use |

### Scope Defaults

- **Default**: repo + user scopes
- `--repo-only`: excludes user scope

### User-Scope Roots

Checked with `exists: bool` in output:

- `$CODEX_HOME` (defaults to `~/.codex`)
- `~/.config/Code/User`
- `~/.gemini`
- `~/Documents/Cline/Rules`
- `~/.continue`
- `~/.cursor`
- `~/.claude`

### Submodules

- **Skip submodules** by default (stop at submodule boundaries)

### Symlinks

- **Follow symlinks** and report the resolved target path
- **Track visited inodes** to detect and handle circular symlinks
- Report warning for circular symlinks, skip the cycle
- Include external targets (symlinks pointing outside scan roots)
- **Show full resolved path** for external symlinks in output

### Directory Configs

- **Enumerate individual files** within config directories (e.g., `.cursor/rules/*`)
- **Include all files** including dotfiles (no filtering of hidden files)
- No depth or file count limits
- **Full recursive scan** for directories provided via `--stdin`

### Gitignore

- Report all matching files regardless of .gitignore status
- Include `gitignored: bool` field for each config entry
- Shell out to `git check-ignore` for accurate results

### Case Sensitivity

- **Always case-insensitive** pattern matching across all platforms
- `CLAUDE.md` matches `claude.md` on Linux, macOS, and Windows

### Unicode Paths

- **Output raw as-is** - no Unicode normalization (preserve OS-native encoding)

### Parallelism

- Use `errgroup` with semaphore for bounded concurrent I/O
- Scale based on `runtime.NumCPU()`
- Hash files parallel with discovery (single pass)
- Use discovery-time file state (no re-stat on read)

---

## Pattern Registry

### Location & Loading

Runtime-loaded from disk with XDG-compliant fallback:

1. `~/.config/markdowntown/ai-config-patterns.json`
2. `/etc/markdowntown/ai-config-patterns.json`
3. Beside the `markdowntown` binary

**Fail if multiple registries exist** - user must delete or specify one explicitly.

For testing, use `MARKDOWNTOWN_REGISTRY` environment variable to override.

### Format

Strict JSON (no comments). Use `notes` field for documentation.

### Schema

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
      "notes": "Requires VS Code setting to apply",
      "hints": [
        {
          "type": "requires-setting",
          "setting": "github.copilot.chat.codeGeneration.useInstructionFiles"
        }
      ],
      "docs": [
        "https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot"
      ]
    }
  ]
}
```

### Pattern Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Unique identifier for this pattern |
| `toolId` | string | yes | Normalized tool ID (lowercase, hyphenated) |
| `toolName` | string | yes | Human-readable tool name |
| `kind` | enum | yes | One of: `instructions`, `config`, `prompts`, `rules`, `skills`, `agent` |
| `scope` | enum | yes | One of: `repo`, `user`, `global` |
| `paths` | string[] | yes | Glob or regex patterns (full path from scan root) |
| `type` | enum | no | `glob` (default) or `regex` |
| `loadBehavior` | enum | yes | How files are discovered (see below) |
| `application` | enum | yes | When config takes effect (see below) |
| `applicationField` | string | no | Frontmatter field for `pattern-matched` application |
| `notes` | string | no | Human-readable activation hints |
| `hints` | object[] | no | Structured activation hints |
| `docs` | string[] | yes | Official documentation URLs |

### loadBehavior Values

| Value | Description |
| --- | --- |
| `single` | One file at a fixed location (e.g., `.github/copilot-instructions.md`) |
| `nearest-ancestor` | Walk up from cwd to root, first match wins (e.g., `GEMINI.md`) |
| `all-ancestors` | Walk up from cwd to root, all matches merge (e.g., `CLAUDE.md`) |
| `directory-glob` | All files matching glob in directory merge (e.g., `.cursor/rules/*`) |

### application Values

| Value | Description |
| --- | --- |
| `automatic` | Always active for everything in scope |
| `pattern-matched` | Frontmatter specifies which files it applies to |
| `invoked` | Must be explicitly invoked by name (e.g., skills) |
| `selected` | Must be selected from a menu (e.g., prompts) |

### Hint Types

Strictly enumerated. For v1, only:

| Type | Description |
| --- | --- |
| `requires-setting` | Requires a specific tool/IDE setting to be enabled |

### Pattern Matching

- **Default type**: glob (shell-style: `*`, `**`, `?`)
- **Regex**: when `type: "regex"` specified, full regex syntax
- **Case-insensitive** matching always
- **Full path matching**: patterns match against full path relative to scan root
- **Path expansion**: `~` expands to home directory

### Rigor

Only add patterns with official documentation. If docs link becomes dead (link rot), keep pattern with warning in validation.

### Validation

- **Fail fast** if registry contains malformed patterns (bad regex)
- Error message includes **full pattern dump** for debugging

---

## Output Schema

### Top-Level Structure

```json
{
  "schemaVersion": "1.0.0",
  "registryVersion": "1.0",
  "toolVersion": "0.1.0",
  "scanStartedAt": 1735561234567,
  "generatedAt": 1735561235123,
  "timing": {
    "discoveryMs": 45,
    "hashingMs": 120,
    "gitignoreMs": 30,
    "totalMs": 556
  },
  "repoRoot": "/path/to/repo",
  "scans": [],
  "configs": [],
  "warnings": []
}
```

### Versions

- `schemaVersion`: Full semver (1.0.0) for output JSON format
- `registryVersion`: From registry file
- `toolVersion`: markdowntown binary version

### Timestamps

All timestamps are **Unix epoch milliseconds** (integers).

### JSON Formatting

- **Pretty-printed by default** (indented)
- `--compact` flag for minified output
- **Always include trailing newline** (POSIX-friendly)
- Field names use **camelCase** (explicit Go struct tags)
- Output keys follow the schema order as defined by the implementation structs (no additional key sorting)

### Scans Array

Lists only roots that were actually scanned:

```json
{
  "scans": [
    { "scope": "repo", "root": "/path/to/repo", "exists": true },
    { "scope": "user", "root": "/Users/me/.gemini", "exists": true },
    { "scope": "user", "root": "/Users/me/.codex", "exists": false }
  ]
}
```

With `--repo-only`, only repo root appears in scans array.

### Config Entry

```json
{
  "path": "/path/to/repo/.github/copilot-instructions.md",
  "scope": "repo",
  "depth": 0,
  "sizeBytes": 1240,
  "sha256": "a1b2c3...",
  "mtime": 1735500000000,
  "gitignored": false,
  "frontmatter": {
    "applyTo": "**/*.tsx",
    "description": "React component guidelines"
  },
  "tools": [
    {
      "toolId": "github-copilot",
      "toolName": "GitHub Copilot",
      "kind": "instructions",
      "loadBehavior": "single",
      "application": "automatic",
      "matchedPattern": ".github/copilot-instructions.md",
      "notes": "Requires VS Code setting to apply",
      "hints": [
        {
          "type": "requires-setting",
          "setting": "github.copilot.chat.codeGeneration.useInstructionFiles"
        }
      ]
    }
  ]
}
```

### Config Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `path` | string | no | Absolute path (OS-native separators) |
| `scope` | enum | no | `repo`, `user`, or `global` |
| `depth` | int | no | Distance from scan root (0 = at root) |
| `sizeBytes` | int | yes | Null if read error; 0 for empty files |
| `sha256` | string | yes | Null if read error |
| `mtime` | int | no | Last modified time (epoch ms) |
| `gitignored` | bool | no | Whether file matches .gitignore |
| `frontmatter` | object | yes | Parsed YAML frontmatter, null if none |
| `frontmatterError` | string | yes | Error if frontmatter parsing failed |
| `content` | string | yes | File contents (included by default; omitted with `--no-content`) |
| `contentSkipped` | string | yes | Reason content was skipped (e.g., `"binary"`) |
| `error` | string | yes | Error code if read failed (e.g., `"EACCES"`) |
| `warning` | string | yes | Warning if issue detected (e.g., `"empty"`) |
| `tools` | object[] | no | Tools that recognize this config |

### Depth Calculation

- **Repo scope**: relative to repo root
- **User scope**: relative to user root (e.g., `~/.claude/settings.json` has depth 0)

### Tool Entry (within config)

| Field | Type | Description |
| --- | --- | --- |
| `toolId` | string | Normalized ID (e.g., `github-copilot`) |
| `toolName` | string | Display name (e.g., `GitHub Copilot`) |
| `kind` | enum | `instructions`, `config`, `prompts`, `rules`, `skills`, `agent` |
| `loadBehavior` | enum | `single`, `nearest-ancestor`, `all-ancestors`, `directory-glob` |
| `application` | enum | `automatic`, `pattern-matched`, `invoked`, `selected` |
| `matchedPattern` | string | The glob/regex pattern that matched this file |
| `notes` | string | Human-readable activation hint |
| `hints` | object[] | Structured activation hints |

Tools array is **sorted alphabetically by toolId** for determinism.

### stdin Paths

Paths provided via `--stdin` that don't match any registered pattern:
- Included in output with an **empty** `tools` array
- Add warning `UNRECOGNIZED_STDIN` at the file path
- Directories are recursively scanned
- Empty or whitespace-only lines are ignored

### Warnings Array

```json
{
  "warnings": [
    { "path": "/path/to/file", "code": "EACCES", "message": "Permission denied" },
    { "path": "/path/to/file", "code": "CIRCULAR_SYMLINK", "message": "Circular symlink detected" }
  ]
}
```

**One warning per occurrence** - no deduplication.

### Conflict Detection

When same tool has multiple matches for same scope and kind, add warning:

```json
{
  "path": "/path/to/repo",
  "code": "CONFIG_CONFLICT",
  "message": "cursor has conflicting configs: .cursorrules, .cursor/rules/main.md"
}
```

Conflicts are **inferred from tool+scope+kind** matching.

Do **not** warn for known override pairs where the tool specifies precedence (e.g., `AGENTS.override.md` and `AGENTS.md` in the same directory).

Do **not** warn when the pattern's `loadBehavior` expects multiple files (e.g., `directory-glob`, `all-ancestors`, `nearest-ancestor`).

### Multi-Tool Files

Files like `CLAUDE.md` that are recognized by multiple tools get a **single config entry** with multiple items in the `tools` array. Deduplication is by resolved absolute path.

### Sorting Order

Configs are sorted deterministically: **scope → depth → path**

1. By scope: `repo` < `user` < `global`
2. Within scope: by depth (0 = closest to root)
3. Within depth: alphabetical by path

---

## Content Handling

### Content Inclusion

File contents are included in the `content` field by default. Use `--no-content` to omit content.

### Frontmatter Parsing

**Always parse frontmatter** regardless of `--no-content` flag:
- Extract YAML frontmatter between `---` delimiters
- Include entire frontmatter as `frontmatter` object
- If no frontmatter: `frontmatter: null`
- If malformed: include file with `frontmatterError` field
- When content is included, `content` is the raw file contents (frontmatter not stripped)

### Binary Files

- Detect binary content using Go's `http.DetectContentType`
- Set `content: null` with `contentSkipped: "binary"`

### No Size Limit

Include full content regardless of file size.

### Hashing

- **Always compute SHA256** regardless of file size
- Hash raw bytes (no encoding normalization)
- Hash in parallel with discovery (single pass)

### Empty Files

- Include in output with `sizeBytes: 0` and `warning: "empty"`

---

## Error Handling

### Unreadable Files

Include the config entry with:

- `sizeBytes: null`
- `sha256: null`
- `error: "EACCES"` (or relevant error code)

### Unreadable Directories

- Add warning and continue scanning siblings
- Do not propagate error to children

### Bad Registry Patterns

**Fail fast** on registry load if patterns are malformed. Error includes full pattern dump.

---

## registry validate Command

### Usage

```bash
markdowntown registry validate
```

### Output

JSON structured output:

```json
{
  "valid": true,
  "registryPath": "/path/to/ai-config-patterns.json",
  "version": "1.0",
  "patternCount": 25,
  "toolCount": 10,
  "checks": {
    "syntax": { "passed": true },
    "schema": { "passed": true },
    "patterns": { "passed": true, "details": [] },
    "uniqueIds": { "passed": true },
    "docsReachable": { "passed": false, "details": [
      { "patternId": "windsurf-rules", "url": "https://...", "error": "404 Not Found" }
    ]}
  }
}
```

### Validation Checks

1. **Syntax**: Valid JSON
2. **Schema**: Required fields present, types correct
3. **Patterns**: All glob/regex patterns compile
4. **Unique IDs**: No duplicate pattern IDs
5. **Docs Reachable**: All documentation URLs return 2xx after following redirects

---

## tools list Command

### Usage

```bash
markdowntown tools list
```

### Output

JSON array of tools:

```json
[
  {
    "toolId": "claude-code",
    "toolName": "Claude Code",
    "patternCount": 4,
    "docs": [
      "https://docs.anthropic.com/..."
    ]
  }
]
```

No filtering options - consumers filter the JSON.

---

## Research-Backed Discovery Patterns

### VS Code + Copilot CLI Discovery Matrix

#### VS Code (Copilot Chat)

| Scope | Pattern | Kind | loadBehavior | Notes |
| --- | --- | --- | --- | --- |
| repo | `.github/copilot-instructions.md` | instructions | single | Combined with other instruction types; ordering is undefined. |
| repo | `.github/instructions/*.instructions.md` | instructions | directory-glob | `applyTo` frontmatter controls targeting. |
| repo | `.github/prompts/*.prompt.md` | prompts | directory-glob | Prompt files (experimental). |
| repo | `AGENTS.md` | instructions | nearest-ancestor | Requires `chat.useAgentsMdFile`; nested AGENTS needs `chat.useNestedAgentsMdFiles`. |
| user | `~/.config/Code/User/prompts/*.prompt.md` | prompts | directory-glob | User profile prompt files (Unix-like path). |
| user | `~/.config/Code/User/profiles/*/prompts/*.prompt.md` | prompts | directory-glob | VS Code profiles (Unix-like path). |

#### Copilot CLI

| Scope | Pattern | Kind | loadBehavior | Notes |
| --- | --- | --- | --- | --- |
| repo | `.github/copilot-instructions.md` | instructions | single | Repo instructions for Copilot CLI. |
| repo | `.github/copilot-instructions/**/*.instructions.md` | instructions | directory-glob | Nested instruction files. |
| repo | `AGENTS.md` | instructions | nearest-ancestor | Nearest file wins in directory tree. |
| repo | `.github/agents/*.md` | agent | directory-glob | Custom Copilot CLI agents. |
| user | `~/.copilot/config.json` | config | single | Use `$XDG_CONFIG_HOME/copilot/config.json` when set. |
| user | `~/.copilot/mcp-config.json` | config | single | Use `$XDG_CONFIG_HOME/copilot/mcp-config.json` when set. |
| user | `~/.copilot/agents/*.md` | agent | directory-glob | User-scoped agents. |

Notes:
- Instruction ordering is undefined when multiple instruction file types exist; treat conflicts as ambiguous.
- `chat.instructionsFilesLocations` custom instruction locations are not auto-discovered; use `--stdin` for custom paths.
- XDG config overrides: when `$XDG_CONFIG_HOME` is set, use it for Copilot CLI config paths.
- VS Code user profile prompt paths vary by OS; current coverage targets Unix-like paths.

### Repo-Scoped: GitHub Copilot

| Pattern | Kind | loadBehavior | application |
| --- | --- | --- | --- |
| `.github/copilot-instructions.md` | instructions | single | automatic |
| `.github/instructions/*.instructions.md` | instructions | directory-glob | pattern-matched |
| `.github/prompts/*.prompt.md` | prompts | directory-glob | selected |

Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot

### Repo-Scoped: Root Instruction Files

| Pattern | Tool | Kind | loadBehavior |
| --- | --- | --- | --- |
| `AGENTS.override.md` | codex | instructions | all-ancestors |
| `AGENTS.md` | codex | instructions | all-ancestors |
| `CLAUDE.md` | claude-code | instructions | all-ancestors |
| `GEMINI.md` | gemini-cli | instructions | nearest-ancestor |

### OpenAI Codex

| Scope | Pattern | Kind | loadBehavior | application |
| --- | --- | --- | --- | --- |
| repo | `AGENTS.override.md` | instructions | all-ancestors | automatic |
| repo | `AGENTS.md` | instructions | all-ancestors | automatic |
| repo | `.codex/skills/**/SKILL.md` | skills | directory-glob | invoked |
| user | `~/.codex/AGENTS.override.md` | instructions | single | automatic |
| user | `~/.codex/AGENTS.md` | instructions | single | automatic |
| user | `~/.codex/config.toml` | config | single | automatic |
| user | `~/.codex/prompts/*.md` | prompts | directory-glob | selected |
| user | `~/.codex/skills/**/SKILL.md` | skills | directory-glob | invoked |

Docs:
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/cli/slash-commands
- https://developers.openai.com/codex/skills

Notes:
- `AGENTS.override.md` supersedes `AGENTS.md` in the same directory.
- Codex prompts are invoked by name (e.g., `/prompts:foo`) and only top-level `*.md` files are recognized.
- Codex skills are invoked by name (e.g., `/skills` or `$skill-name`) and use `SKILL.md` metadata.

### Gemini CLI

| Scope | Pattern | Kind | loadBehavior |
| --- | --- | --- | --- |
| repo | `GEMINI.md` | instructions | nearest-ancestor |
| user | `~/.gemini/GEMINI.md` | instructions | single |
| user | `~/.gemini/settings.json` | config | single |
| repo | `.geminiignore` | config | single |

Docs: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli.md

### Cursor

| Scope | Pattern | Kind | loadBehavior |
| --- | --- | --- | --- |
| repo | `.cursor/rules/**/*` | rules | directory-glob |
| repo | `.cursorrules` | rules | single |

Docs: https://docs.cursor.com/context/rules

### Cline

| Scope | Pattern | Kind | loadBehavior |
| --- | --- | --- | --- |
| repo | `.clinerules/**/*` | rules | directory-glob |
| repo | `.clinerules` (file) | rules | single |
| user | `~/Documents/Cline/Rules/**/*` | rules | directory-glob |

Docs: https://docs.cline.bot/prompting/clinerules

### Aider

| Scope | Pattern | Kind | loadBehavior |
| --- | --- | --- | --- |
| repo | `.aider.conf.yml` | config | single |
| repo | `.aider.conf` | config | single |
| repo | `.aider.conf.toml` | config | single |

Docs: https://aider.chat/docs/config.html

### Continue

| Scope | Pattern | Kind | loadBehavior |
| --- | --- | --- | --- |
| user | `~/.continue/config.yaml` | config | single |
| user | `~/.continue/config.json` | config | single |
| user | `~/.continue/config.ts` | config | single |

Docs: https://docs.continue.dev/configuration/configuration-file

### Claude Code

| Scope | Pattern | Kind | loadBehavior | application |
| --- | --- | --- | --- | --- |
| repo | `CLAUDE.md` | instructions | all-ancestors | automatic |
| repo | `.claude/settings.json` | config | single | automatic |
| repo | `.claude/commands/**/*` | skills | directory-glob | invoked |
| user | `~/.claude/CLAUDE.md` | instructions | single | automatic |
| user | `~/.claude/settings.json` | config | single | automatic |

Docs: https://docs.anthropic.com/en/docs/claude-code/settings

### Codex CLI Workflow Notes (non-scanning)

- `/init` can scaffold `AGENTS.md` quickly.
- `/prompts` and `/skills` list available Codex prompts and skills.

---

## Project Structure (Greenfield)

```text
markdowntown/
├── cmd/
│   └── markdowntown/
│       └── main.go
├── internal/
│   ├── scan/
│   │   ├── scanner.go      # Core scanning logic
│   │   ├── registry.go     # Pattern registry loading
│   │   ├── matcher.go      # Glob/regex matching
│   │   ├── frontmatter.go  # YAML frontmatter parsing
│   │   └── output.go       # JSON output formatting
│   ├── git/
│   │   ├── root.go         # Git root detection
│   │   └── ignore.go       # Gitignore checking
│   └── hash/
│       └── sha256.go       # File hashing
├── data/
│   └── ai-config-patterns.json
├── testdata/
│   └── repos/              # Real-world sample repos for testing
├── .github/
│   └── workflows/
│       ├── ci.yml          # Main CI workflow
│       └── release.yml     # Release workflow
├── .golangci.yml           # Linter config (strict)
├── .goreleaser.yml         # Release config
├── .lefthook.yml           # Pre-commit hooks
├── Makefile
├── go.mod
├── go.sum
└── README.md
```

---

## Development Infrastructure

### Makefile Targets

| Target | Description |
| --- | --- |
| `make build` | Build binary |
| `make test` | Run tests |
| `make lint` | Run golangci-lint |
| `make fmt` | Auto-fix formatting (gofmt -w) |
| `make check` | Run all checks (lint + test) |
| `make clean` | Remove build artifacts |
| `make install` | Install to GOPATH/bin |
| `make coverage` | Run tests with coverage |
| `make coverage-report` | Print per-package coverage from `coverage.out` |
| `make coverage-html` | Generate HTML coverage report |
| `make release` | Build release with goreleaser |
| `make snapshot` | Build snapshot release (no publish) |
| `make run` | Build and run |
| `make watch` | Watch for changes and rebuild (air) |
| `make dev` | Combined watch + test on change |

### Pre-commit Hooks

Managed by **lefthook** (Go-native, fast):
- Runs **formatting + lint + unit tests** on commit
- Install via `lefthook install`
- Optional for contributors; CI remains authoritative

### Linting

**golangci-lint** with strict configuration:
- errcheck, gosec, gocritic, staticcheck, etc.
- Config in `.golangci.yml`

### CI/CD

#### GitHub Actions Matrix

| Dimension | Values |
| --- | --- |
| Go Version | 1.22, 1.23 |
| OS | ubuntu-latest, macos-latest, windows-latest |
| Arch | amd64, arm64 |

Full matrix: 2 × 3 × 2 = 12 combinations

#### CI Jobs

- **Lint**: golangci-lint
- **Test**: go test with coverage
- **Build**: produce binaries as artifacts
- **Integration**: download well-known repos and test

All jobs run in parallel with shared dependency cache.

### Releases

**goreleaser** handles:
- Cross-compilation for all platforms
- Checksums and signatures
- GitHub release creation
- Changelog generation

Triggered on version tags.

---

## Testing Strategy

### Fixtures

**Sanitized real repos** from open-source projects:
- Committed to `testdata/repos/`
- Include minimal `.git` directories (committed, not recreated)
- Add new fixtures when bugs are discovered

### Integration Tests

- **Always run in CI** (not opt-in)
- Download well-known public repos
- Verify scanning produces expected results

### Golden File Tests

- Store expected JSON output in `testdata/golden/`
- **Compare structure, ignore timestamp values**
- Update with `go test -update-golden`

### Fuzz Testing

- Use Go's native fuzzing for glob/regex pattern matching
- Target `internal/scan/matcher.go`

### Coverage

- **80%+ required** - CI fails if below threshold
- Per-package coverage tracking via `scripts/coverage_report.py` (`make coverage-report`)
- HTML reports via `make coverage-html`

### Version Checks

- Test that `schemaVersion` in output matches defined constant
- Catch version bump oversights
  - Scan CLI: `cmd/markdowntown/scan_cli_test.go`
  - Audit CLI: `cmd/markdowntown/audit_cli_test.go`

### Test Cases

Sanitized real-world fixture coverage lives under `testdata/repos/integration` (e.g., `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.claude/rules/*.md`).

1. Pattern expansion (glob and regex) — `internal/scan/matcher_test.go` (glob + regex tests)
2. Multi-tool file deduplication — `internal/scan/scanner_integration_test.go` (shared/config.json)
3. Symlink resolution (including external targets, circular detection) — `internal/scan/scanner_test.go` (circular symlink warning)
4. Error handling (permission denied, missing files) — `internal/scan/scanner_test.go` (EACCES + ENOENT)
5. Empty file detection — `internal/scan/scanner_test.go` (empty warning)
6. Sorting determinism — `internal/scan/scanner_integration_test.go` (golden output)
7. User-scope root existence detection — `internal/scan/scanner_test.go` (missing user root)
8. Frontmatter parsing (valid, invalid, missing) — `internal/scan/scanner_integration_test.go` + `internal/scan/scanner_test.go`
9. Conflict detection (including Codex override precedence) — `internal/scan/scanner_integration_test.go`
10. stdin path handling — `internal/scan/scanner_integration_test.go` (UNRECOGNIZED_STDIN)
11. Codex prompts/skills discovery — `internal/scan/scanner_integration_test.go` (user .codex fixtures)

---

## Future Considerations (Out of v1 Scope)

### Separate Command: Remote Scanning

`markdowntown scan-remote <git-url>` — Clone to temp dir, scan, clean up.

### Effective Config Computation

Add `--for-file <path>` flag to filter output to configs that would apply to a specific file, using loadBehavior/precedence logic.

### VS Code Custom Paths

Consider reading `settings.json` to discover custom `chat.instructionsFilesLocations`.

### Codex Dynamic Instruction Names

Read `project_doc_fallback_filenames` from `~/.codex/config.toml` to include custom instruction filenames in scanning.

### Multi-Root Workspaces

Support for VS Code-style `.code-workspace` files with multiple roots.

### JSONL Output

May be useful for `--watch` mode or streaming large results.

### Custom Patterns

Allow user-defined patterns in `~/.config/markdowntown/custom-patterns.json`.

---

## Acceptance Criteria

- [ ] `markdowntown scan` produces deterministic JSON for all documented patterns
- [ ] Pattern registry is external JSON with versioning and docs links
- [ ] Registry loaded from XDG paths with proper error on ambiguity
- [ ] Scans array shows only actually scanned roots with existence status
- [ ] Multi-tool files have single entry with tools array (sorted by toolId)
- [ ] Progress shows live path scanning in TTY mode
- [ ] Auto-disable progress in non-TTY environments
- [ ] `--include-content`/`--no-content` works with binary file detection
- [ ] Frontmatter always parsed and included
- [ ] Exit 1 on fatal error (bad registry, git unavailable)
- [ ] `markdowntown registry validate` performs full validation with JSON output
- [ ] `markdowntown tools list` outputs JSON array with docs
- [ ] Tests use sanitized real-world repo samples
- [ ] Golden file tests for output stability
- [ ] Fuzz testing for pattern matching
- [ ] 80%+ test coverage enforced
- [ ] `--version` outputs `markdowntown X.Y.Z (schema A.B.C)`
- [ ] Makefile provides all dev/CI targets
- [x] Pre-commit hooks via lefthook
- [ ] CI matrix covers Go 1.22+1.23 × all OS × all arch
- [x] goreleaser produces release binaries
