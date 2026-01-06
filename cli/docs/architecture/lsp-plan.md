# Markdowntown LSP implementation plan

## Objective

Provide a Language Server Protocol (LSP) server backed by markdowntown-cli scan + audit logic that delivers diagnostics and editing helpers for AI config files, with a VS Code extension as the primary client.

## Current state (implemented)

- **Shared core**: `internal/scan` + `internal/audit` reused by the LSP via `afero.Fs`; core logic avoids stdout.
- **Overlay FS**: `afero.NewCopyOnWriteFs` (MemMap + OS) to support unsaved buffers.
- **Diagnostics**: debounced on `didOpen`/`didChange`, respects client capabilities (tags, codeDescription, related info) and settings (rule filters, severity overrides, redaction, evidence). Severity overrides apply after rule evaluation but before filtering.
- **Hover**: toolId hover shows registry notes + docs.
- **Definition**: toolId jumps to the registry entry in `ai-config-patterns.json` or fallback to repo `AGENTS.md`.
- **Completion**: toolId suggestions from the registry.
- **Code actions**: quick fixes for common audit rules and frontmatter repairs.
- **Code lens**: shows active/shadowed scope for a config file.
- **Document symbols**: tree view of config blocks and fields.

## Architecture: shared core + LSP adapter

- **Core logic (`internal/scan`, `internal/audit`)**
  - Accepts `afero.Fs` + registry inputs.
  - Returns structured issues and scan results.
  - Avoids direct stdout writes (LSP uses stdout for JSON-RPC).
- **LSP adapter (`internal/lsp`)**
  - Maintains overlay FS, frontmatter cache, and diagnostic debounce timers.
  - Maps `audit.Issue` to `protocol.Diagnostic` (ranges, tags, codeDescription, related info).
  - Runs via `glsp` stdio transport.

## Safety: stdout hygiene

- Stdout is reserved for JSON-RPC. LSP logging must go to stderr (via `commonlog` or the VS Code output channel).
- `markdowntown serve` should avoid any stdout writes outside JSON-RPC frames.
- Consider adding a lint/test guard (forbidigo or stdout capture) to enforce this contract.

## Implementation details

- **Frontmatter parsing** uses `yaml.v3` nodes to preserve line/column, with a location map stored on scan results.
- **Range conversion** translates UTF-8 byte offsets to LSP UTF-16 positions (multi-byte correctness).
- **Diagnostics pipeline**: scan → gitignore filter → audit rules → diagnostics (with optional evidence + related info).
- **Settings** come from initialization options and `workspace/didChangeConfiguration` and apply live.
- **Document symbols** provide a `DocumentSymbol` tree per file, rooted at config blocks with children for key fields (toolId, model, scope, etc.).
- **Definition (registry-aware)** resolves toolId to `ai-config-patterns.json` when available, with multiple locations for duplicated IDs.

## Open questions + assumptions

- Document symbols should only surface AI config files (assume `AGENTS.md` + tool config files).
- Registry resolution prefers `markdowntown.registryPath` or `MARKDOWNTOWN_REGISTRY` when present.
- Definition requests should be tolerant when scans are incomplete (return null rather than error).
- If registry lookups ever become remote, they must be time-bounded and async.

## VS Code integration

- Extension launches `markdowntown serve` and passes the registry path via `MARKDOWNTOWN_REGISTRY`.
- Key settings:
  - `markdowntown.serverPath`
  - `markdowntown.registryPath`
  - `markdowntown.diagnostics.enabled` (bool): enable/disable diagnostics
  - `markdowntown.diagnostics.delayMs` (int): debounce delay
  - `markdowntown.diagnostics.rulesEnabled` (string[]): allowlist of rule IDs
  - `markdowntown.diagnostics.rulesDisabled` (string[]): blocklist of rule IDs
  - `markdowntown.diagnostics.severityOverrides` (map[string]string): rule ID → severity (error/warning/info/hint)
  - `markdowntown.diagnostics.includeRelatedInfo` (bool): include related information
  - `markdowntown.diagnostics.includeEvidence` (bool): include evidence in diagnostics
  - `markdowntown.diagnostics.redactPaths` (string): redaction mode (never/relative/full)
- Output channel captures stderr; stdout must remain JSON-RPC only.
- Activation languages: markdown, json, yaml, toml, instructions.
