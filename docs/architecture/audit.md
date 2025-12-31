# Audit Architecture (v1)

## Goals
- Deterministic audit output suitable for CI and automation.
- Metadata-only analysis by default; avoid content reads unless a rule requires it.
- Privacy-aware reporting for user-scope paths.
- Fail-closed behavior when instruction ordering is undefined.

## Package Map
| Package | Responsibility |
| --- | --- |
| cmd/markdowntown | CLI entrypoint, flag parsing, exit codes, format selection |
| internal/audit | Rule engine, issue schema, redaction, ordering |
| internal/scan | Scan execution + schema parsing for inline audits |
| internal/version | Tool + schema version constants |

## Data Flow
1. Parse CLI flags into audit.Options.
2. Resolve input mode:
   - If `--input` provided: read scan JSON from file/stdin and validate schema.
   - Else: run internal scan (using `--repo`, `--repo-only`, `--stdin`).
3. Normalize scan metadata and configs into audit input structures.
4. Apply exclusion filters (`--exclude`) and rule ignores (`--ignore-rule`).
5. Execute rules in deterministic order; each rule emits zero or more issues.
6. Redact paths based on scope (repo-relative, `~/` for user scope).
7. Sort issues (severity → ruleId → path → toolId).
8. Render output as JSON or Markdown.

## Rule Engine
- Rules are pure functions: input scan metadata + config/tool entries → issues.
- Rules must be deterministic and side-effect free.
- v1 rules are metadata-only and should not read `content`.

## Redaction & Privacy
- Repo scope: path normalized to `./<relative>`.
- User scope: path normalized to `~/<relative>`.
- Global scope: absolute paths allowed.
- Evidence payloads must avoid raw content by default.

## Determinism
- Rules are executed in a fixed registry order (by ruleId).
- Output ordering is enforced after rule execution.
- JSON field order follows struct order (no additional key sorting).

## Error & Warning Handling
- Scan-level warnings are passed through as audit issues only when a rule maps them.
- Malformed scan input, schema mismatch, or invalid flags are fatal (exit code 2).
- Audit never re-implements scan conflict detection; it consumes scan warnings.

## CLI UX
- `audit` is non-interactive and supports stdin input via `--input -`.
- When running internal scan, progress is emitted to stderr (consistent with `scan`).
- Output is always on stdout; errors on stderr.
