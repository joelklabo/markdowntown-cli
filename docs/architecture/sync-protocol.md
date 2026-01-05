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
