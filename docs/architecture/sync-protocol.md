# CLI ↔ web sync protocol (CAS + patches)

## Summary
Define a deterministic, content-addressed sync flow that lets the CLI upload repo snapshots, the web app run audits, and users send patches back to the CLI with explicit conflict handling. The server never mutates local files directly; it only stores blobs, manifests, and patches.

## Goals
- Deduplicate file uploads with content-addressed storage (CAS).
- Keep sync deterministic and resumable.
- Support patch round-trips with explicit conflict detection.
- Preserve CLI output stability (schema, ordering, and hashes).

## Non-goals
- Full git history sync.
- Real-time collaborative editing.
- Server-side auto-merge of conflicting edits.

## Terminology
- **Blob**: A file’s content hashed by `sha256`.
- **Manifest**: Ordered list of file paths → blob hashes + metadata.
- **Snapshot**: Immutable view of a repo at a moment in time.
- **Patch**: Diff generated from web edits, tied to a base snapshot + blob hash.

## Canonical manifest hash

The manifest hash provides a deterministic fingerprint of a snapshot's file list. It must be stable across CLI versions and platforms to support reliable delta uploads and conflict detection.

### Hash Inputs
The manifest hash is computed from the ordered array of `ManifestEntry` objects, each containing:

| Field | Type | Format | Notes |
| --- | --- | --- | --- |
| `path` | string | Forward slash separators | Relative to repo root. Normalized with `filepath.ToSlash()`. |
| `blobHash` | string | Hex-encoded SHA256 (64 chars) | Lowercase hex. |
| `size` | int64 | Bytes | File size in bytes. |
| `mode` | int64 | Unix permission bits | Result of `info.Mode().Perm()` (e.g., `0644` → `420`). |
| `mtime` | int64 | Unix milliseconds | Result of `info.ModTime().UnixMilli()`. |
| `isDeleted` | bool | Optional | Present only if `true` (omitempty). |

### Canonical Encoding
1. **Sorting**: Entries are sorted lexicographically by `path` (ascending, UTF-8 byte order).
2. **Serialization**: The sorted array is serialized to JSON using Go's `encoding/json.Marshal()` with default settings:
   - No custom marshal functions
   - No pretty-printing (compact JSON)
   - Default struct tag behavior (omitempty for `isDeleted`)
3. **Hashing**: The JSON byte sequence is hashed with SHA256 and hex-encoded (lowercase).

### Pseudo-code

```text
entries = []ManifestEntry{ ... }
sort(entries, by=path, order=ascending)
json = Marshal(entries)
hash = hex(sha256(json))
```

### Example
Given two files:
- `README.md` (5 bytes, hash `2cf2...`, mtime `1735800245000`, mode `420`)
- `dir/nested.txt` (5 bytes, hash `7c55...`, mtime `1735800245000`, mode `420`)

Canonical JSON (whitespace added for readability, but actual JSON is compact):

```json
[
  {
    "path": "README.md",
    "blobHash": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    "size": 5,
    "mode": 420,
    "mtime": 1735800245000
  },
  {
    "path": "dir/nested.txt",
    "blobHash": "7c552ca5a8e87c4c5f23b3e9e2f4e6d8a1b9c0d3e4f5a6b7c8d9e0f1a2b3c4d5",
    "size": 5,
    "mode": 420,
    "mtime": 1735800245000
  }
]
```

Manifest hash: `sha256(compact_json)` → hex-encoded result.

### Edge Cases

#### Empty Manifest
- **Input**: `[]` (empty array)
- **JSON**: `[]`
- **Hash**: `sha256([]) = 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`

#### Deleted Files
- **Input**: Entry with `isDeleted: true`
- **JSON**: Includes `"isDeleted":true` field
- **Sorting**: Deleted entries sort alongside non-deleted by `path`

#### Mtime Precision
- **CLI computes**: `ModTime().UnixMilli()` (milliseconds since epoch)
- **Server validates**: Exact mtime match not enforced (mtimes are metadata, not part of content integrity)

#### Path Normalization
- **Windows**: Backslashes converted to forward slashes via `filepath.ToSlash()`
- **Relative paths**: Always relative to repo root, no leading `/`
- **Symlinks**: Not followed (skipped during manifest build)

### Stability Guarantees
- **JSON field order**: Determined by Go struct field order (stable across versions).
- **JSON number format**: Integers are formatted as integers (no scientific notation).
- **Hex encoding**: Always lowercase (Go's `hex.EncodeToString()` default).

### Testing
- **Golden hash test**: `manifest_test.go` includes `TestManifestCanonicalHash` which asserts a fixed manifest hash for a known file set.
- **Round-trip test**: Serialize, hash, deserialize, re-hash → same result.
- **Cross-platform test**: Windows/Unix path normalization produces identical hashes.

## Protocol overview
1. **Handshake**: CLI posts a manifest and gets back the list of missing blob hashes.
2. **Upload**: CLI uploads missing blobs (chunked or direct).
3. **Finalize**: CLI finalizes the snapshot; server marks it ready and triggers scans.
4. **Review**: Web UI reads snapshot files + audit issues.
5. **Patch**: Web user edits a file; server stores a patch tied to a base blob hash.
6. **Apply**: CLI pulls patches and applies them only if base hashes match.

## Snapshot handshake
### Inputs
- Repo identity (slug or ID).
- Snapshot metadata (CLI version, registry version, timestamps).
- `protocolVersion` for negotiation and backward compatibility.
- `idempotencyKey` for safe retries of snapshot creation/finalize.
- Manifest (ordered): `{ path, blobHash, size, mode, mtime, isDeleted? }`.

### Flow
1. **Create snapshot**: CLI sends manifest to `POST /api/cli/snapshots`.
2. **Server response**:
   - `snapshotId`
   - `missingBlobs[]` (hashes)
   - Upload instructions (direct or presigned URLs)
3. **Upload blobs**: CLI uploads each missing blob to the provided endpoint(s).
4. **Finalize**: CLI calls `POST /api/cli/snapshots/:id/finalize`.
5. **Server**:
   - validates blob hashes against manifest
   - marks snapshot `ready`
   - triggers scan/audit run

### Delta uploads
- CLI can send `baseSnapshotId`.
- Server diff’s manifests and returns only missing blobs.
- If base snapshot is unknown or incompatible, server requests a full upload.

## Idempotency + retries
- Snapshot create/finalize calls accept an `idempotencyKey` to prevent duplicates on retry.
- Patch application is idempotent per `patchId`; duplicate apply requests are ignored.
- Upload retries are safe because blob hashes are immutable.

## Offline queueing
- CLI maintains a local upload queue for blobs that cannot be uploaded immediately (offline or transient errors).
- Queue is persisted in local SQLite database with retry backoff (exponential: 1s, 2s, 4s, ... max 5m).
- Patches from server are queued locally and applied when base hashes match.
- Queue size limits prevent unbounded growth during long offline periods (10 snapshots, 10k blobs, 5 GB total).
- See `docs/architecture/cli-sync-local-storage.md` for detailed queue behavior and retry strategy.

## Deletions (tombstones)
- Manifest entries may include `isDeleted: true` to represent file removals.
- Server stores tombstones so deleted paths do not “resurrect” on delta sync.
- Tombstones can be garbage-collected after a retention window.

## Patch flow
### Create patch (web)
1. Web editor loads snapshot files.
2. User edits a file and saves.
3. Server stores a patch with:
   - `snapshotId`, `path`, `baseBlobHash`, `patchFormat` (unified diff)
   - `status = proposed`

### Apply patch (CLI)
1. CLI requests patches for a snapshot: `GET /api/cli/snapshots/:id/patches`.
2. CLI validates base hash against local file hash.
3. If hashes match, apply patch and mark `applied`.
4. If hashes do not match, mark `rejected` and require a fresh snapshot.

## Conflict policy
- **Local files are source of truth**. Server edits are suggestions.
- Patches are only applied when base hashes match.
- Conflicts must be resolved locally, followed by a new snapshot upload.

## Resync / reset flow
- If delta history diverges or manifests are incompatible, CLI performs a full snapshot upload.
- Server can return `requiresFullUpload = true` to force a hard reset.

## Limits and safety
- Enforce file size and snapshot limits.
- Reject unsafe paths (absolute, parent traversal, device files).
- Hash validation is mandatory before finalize.
- Rate-limit device flow and upload endpoints.
- Refresh auth tokens on long uploads; upload tokens should be short-lived.

## Related docs
- Data model: `docs/architecture/cli-sync-data-model.md`
- State machine: `docs/architecture/sync-state-machine.md`
- Local storage: `docs/architecture/cli-sync-local-storage.md`
