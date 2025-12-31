# Suggest Architecture (v1)

## Goals
- Deterministic, evidence-only suggestions (fail-closed).
- Built-in refresh pipeline (no daemon, no MCP).
- Clear separation between evidence gathering and user-facing output.

## Package Map
| Package | Responsibility |
| --- | --- |
| cmd/markdowntown | CLI entrypoint, flag parsing, exit codes, output formatting |
| internal/suggest | Source registry, fetcher, snapshots, normalization, claims, generator |
| internal/instructions | Client adapters (resolve effective instruction chains) |
| internal/git | Repo root detection + gitignore checks |
| internal/hash | SHA256 helper for snapshot hashes |
| internal/version | Tool + schema version constants |

## Data Flow
1. Parse CLI flags into suggest/resolve/audit options.
2. Resolve repo root (git or `--repo`).
3. Load source registry (Tier-0/1 allowlist + refresh cadence).
4. Refresh pipeline (when stale or `--refresh`):
   - robots.txt check
   - conditional GET (ETag/Last-Modified)
   - store snapshot (WARC + hash)
   - update metadata store (last_verified_at, etag, hash)
5. Normalize documents (HTML/MD) into structured sections with stable anchors.
6. Extract claims with normative strength (MUST/SHOULD/MAY/INFO).
7. Detect conflicts across authoritative sources.
8. Generate suggestions (Codex-first) with proof objects and source links.
9. Adapter resolution for `resolve` output (effective chain, conflicts, ordering guarantees).
10. Assemble output (JSON/MD), sorted deterministically.

## Determinism Rules
- Stable ordering of sources, suggestions, conflicts, and omissions.
- Stable IDs derived from content hashes + source URLs.
- Output encoding uses UTF-8 and deterministic JSON formatting.

## Evidence & Conflict Policy
- Suggestion validity requires Tier-0/1 sources for every claim.
- Conflicts or undefined merge order suppress suggestions.
- `audit` surfaces conflict and omission records for transparency.

## CLI UX
- Stdout: structured output (JSON/MD).
- Stderr: diagnostics and progress (TTY only).
- Exit codes: 0 for success with warnings; 1 for fatal errors.

## Security Considerations
- Source allowlist enforced; https-only fetches.
- No secrets accepted via CLI flags.
- Cache paths validated to prevent traversal.
