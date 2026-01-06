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
   - Optional global/system roots when enabled (see Global Scope).
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

## Effective Config Resolution

To support LSP features like CodeLens and `--for-file` filtering, the scanner identifies which configurations are "effective" for a given target path.

### Precedence rules

1. **Scope Priority**: `repo` > `user` > `global`.
2. **Override Pairs**: Within a single scope, certain patterns explicitly supersede others.
   - Example: `AGENTS.override.md` > `AGENTS.md`.
3. **Nearest Ancestor**: For tools that support hierarchical discovery, the config file closest to the target path in the directory tree takes precedence.

### Shadowing

A configuration is **Shadowed** if:
- It has a broader scope than an active configuration for the same `toolId` and `kind`.
- It is the "weak" side of an override pair where the "strong" side exists in the same directory.
- It is further up the directory tree than another configuration for a tool using "nearest ancestor" resolution.

Shadowing only applies to tools with `loadBehavior: "replace"`. Tools that `merge` or `append` do not shadow other configurations in the same or broader scopes.

- Configs sorted by: scope (repo < user < global) -> depth -> path.
- Tools array sorted by toolId; warnings are not deduped.
- Output paths are OS-native; no Unicode normalization.

## Global Scope (System Roots)

- **Opt-in only** via a dedicated flag (proposed: `--global-scope`).
- **Default roots**:
  - Unix-like: `/etc`
  - Windows: *deferred* until a clear system-equivalent root is defined.
- **Safe defaults**:
  - Skip special files (device nodes, FIFOs, sockets).
  - Honor existing symlink cycle detection; emit warnings and skip loops.
  - Treat permission errors as warnings (never fatal).
  - Allowlist-style scanning within the global root (no implicit expansion to `/`).
- **Reporting**:
  - Global roots appear in `scans[]` with `scope: "global"`.
  - Config entries under global scope are sorted after repo and user scopes.

## Concurrency

- Use errgroup with a bounded semaphore for I/O.
- Default worker limit should be bounded (e.g., `runtime.NumCPU()` or a small multiple), and configurable via a flag (proposed: `--scan-workers`).
- Discovery and content hashing can overlap, but output ordering is applied after collection.
- Errors are aggregated into warnings where recoverable; fatal errors remain deterministic.
- Shared mutable state (visited inode map, warning collection) must be synchronized (mutex or channel-owned state); prefer read-only snapshots for workers.
- Cancellation should propagate through the errgroup context to stop outstanding work on fatal errors or interrupts.

## Error and Warning Handling

- Unreadable files generate a config entry with null size/hash and an error code.
- Circular symlinks and permission errors produce warnings and skip traversal.
- Config conflicts are inferred by tool+scope+kind with explicit override exceptions, excluding multi-file `loadBehavior` patterns.
- Partial failures (e.g., one worker hits EACCES) do not abort the scan; they are recorded as warnings and the scan continues.

## Test Plan

- **Global scope safety**: fixtures under a global-root test directory; ensure scope ordering and `scans[]` entries.
- **Permissions**: unreadable files/dirs emit warnings, no fatal error.
- **Symlink loops**: cycles under global scope are detected and skipped.
- **Concurrency determinism**: parallel scan ordering matches serial ordering across runs.
- **Worker limits**: verify `--scan-workers=1` (serial) and higher counts behave correctly.
- **Race detection**: run scan tests with `-race` to validate shared-state locking.
- **Stress**: exercise large file sets to validate FD usage and cancellation behavior.

## CLI UX

- Progress updates stream to stderr when stdout is a TTY and `--quiet` is false.
- Exit codes: 0 for success (even with warnings), 1 for fatal errors.
- `--version` prints tool and schema versions without requiring registry or git.
