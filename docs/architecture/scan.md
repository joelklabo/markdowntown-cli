# Scan Architecture (v1)

## Goals
- Deterministic JSON output for audits and CI.
- Single-pass file processing where possible (discover -> read -> hash).
- Accurate gitignore reporting and robust error handling.

## Package Map
| Package | Responsibility |
| --- | --- |
| cmd/markdowntown | CLI entrypoint, flag parsing, exit codes, progress output |
| internal/scan | Scan orchestration, matching, content pipeline, output assembly |
| internal/git | Git root detection + gitignore checks |
| internal/hash | SHA256 helper for file content |
| internal/version | Tool + schema version constants |

## Data Flow
1. Parse CLI flags into scan.Options.
2. Resolve scan roots:
   - Repo root from git or `--repo`.
   - User roots from known locations (XDG + tool defaults).
   - Optional stdin paths (files/dirs).
3. Discovery pass:
   - Walk roots, using Lstat to detect symlinks.
   - Follow symlinks, track visited inodes to avoid cycles.
   - Skip submodules at boundaries.
   - Capture metadata (path, size, mtime, depth, scope).
4. Matching:
   - Load registry patterns and compile matchers.
   - Match against slash-normalized relative paths (case-insensitive).
   - Create tool entries and dedupe config entries by resolved path.
5. Content pipeline:
   - Read file bytes once.
   - Compute SHA256 (raw bytes).
   - Detect binary content via content type.
   - Parse YAML frontmatter from raw content.
   - Include full content by default; disable with `--no-content`.
6. Gitignore checks:
   - Batch `git check-ignore` calls.
   - Annotate each config entry with gitignored boolean.
7. Output assembly:
   - Build scans/configs/warnings/timing.
   - Sort deterministically.
   - Emit JSON with trailing newline.

## Determinism Rules
- Configs sorted by: scope (repo < user < global) -> depth -> path.
- Tools array sorted by toolId; warnings are not deduped.
- Output paths are OS-native; no Unicode normalization.

## Concurrency
- Use errgroup with a bounded semaphore for I/O.
- Discovery and content hashing can overlap, but output ordering is applied after collection.
- Errors are aggregated into warnings where recoverable.

## Error and Warning Handling
- Unreadable files generate a config entry with null size/hash and an error code.
- Circular symlinks and permission errors produce warnings and skip traversal.
- Config conflicts are inferred by tool+scope+kind with explicit override exceptions.

## CLI UX
- Progress updates stream to stderr when stdout is a TTY and `--quiet` is false.
- Exit codes: 0 for success (even with warnings), 1 for fatal errors.
- `--version` prints tool and schema versions without requiring registry or git.
