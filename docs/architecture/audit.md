# Audit Architecture (v1)

## Goals
- Deterministic audit output suitable for CI and automation.
- Metadata-only analysis by default; avoid content reads unless a rule requires it.
- Privacy-aware reporting for non-repo paths (redaction + pathId).
- Fail-closed behavior when instruction ordering is undefined.

## Package Map
| Package | Responsibility |
| --- | --- |
| cmd/markdowntown | CLI entrypoint, flag parsing, exit codes, format selection |
| internal/audit | Rule engine, issue schema, redaction, ordering, fingerprint |
| internal/scan | Scan execution + schema parsing for inline audits |
| internal/version | Tool + schema version constants |

## Data Flow
1. Parse CLI flags into audit.Options.
2. Resolve input mode:
   - If `--input` provided: read scan JSON from file/stdin and validate schema.
   - Else: run internal scan (using `--repo`, `--repo-only`, `--stdin`).
3. Normalize scan metadata into audit input structures (audit/sourceScan provenance).
4. Apply exclusion filters (`--exclude`) and rule filters (`--only`, `--ignore-rule`).
5. Execute rules in deterministic order; each rule emits zero or more issues.
6. Redact paths based on scope (repo-relative for repo, placeholders for non-repo).
7. Compute issue fingerprints from canonicalized fields.
8. Sort issues (severity error > warning > info → ruleId → path → toolId → kind).
9. Render output as JSON or Markdown; include scan warnings only when `--include-scan-warnings`.

## Rule Engine
- Rules are pure functions: input scan metadata + config/tool entries → issues.
- Rules must be deterministic and side-effect free.
- v1 rules are metadata-only and should not read `content`.
- Conflict detection prefers scan warnings; if structured warnings are absent, rules may group configs as a fallback.

## Redaction & Privacy
- Repo scope: path normalized to `./<relative>`.
- Non-repo scopes: redacted to `$HOME/...`, `$XDG_CONFIG_HOME/...`, or `<ABS_PATH_N>` placeholders.
- Redacted paths include a stable `pathId` so related issues can be correlated.
- Evidence payloads must avoid raw content by default.

## Determinism
- Rules are executed in a fixed order (by ruleId).
- Output ordering is enforced after rule execution.
- JSON field order follows struct order (no additional key sorting).
- Issue fingerprint is computed from canonicalized fields.

## Error & Warning Handling
- Malformed scan input, schema mismatch, or invalid flags are fatal (exit code 2).
- Scan warnings are included only when `--include-scan-warnings` is set.
- Audit avoids duplicating scan warnings already represented as issues.

## CLI UX
- `audit` is non-interactive and supports stdin input via `--input -`.
- When running internal scan, progress is emitted to stderr (consistent with `scan`).
- Output is always on stdout; errors on stderr.
