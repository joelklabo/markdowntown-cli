# CLI Sync Local Storage & Migrations

This document defines the local storage strategy for CLI sync, including offline queueing, schema versioning, and migration patterns.

## Overview

The CLI maintains local state to support offline operation, resumable uploads, and persistent tracking of sync status. This local storage must be versioned and migrated as the sync protocol evolves.

## Storage Locations

### Primary Storage
- **Path:** `~/.markdowntown/sync/`
- **Format:** SQLite database
- **File:** `sync.db`

### Backup/Export
- **Path:** `~/.markdowntown/sync/backup/`
- **Format:** JSONL exports for debugging and recovery

### Lock Files
- **Path:** `~/.markdowntown/sync/locks/`
- **Purpose:** Prevent concurrent sync operations

## Local Schema

### Tables

#### `local_snapshots`
Tracks snapshots created locally (may not yet be finalized on server).

| Field | Type | Notes |
| --- | --- | --- |
| id | text | Snapshot UUID (from server or pending). |
| repoPath | text | Absolute path to local repo. |
| manifestHash | text | Hash of ordered manifest. |
| status | text | `pending`, `uploading`, `ready`, `failed`. |
| createdAt | integer | Unix timestamp (ms). |
| finalizedAt | integer | Unix timestamp (ms). |
| lastErrorCode | text | Error code if failed. |
| lastErrorMessage | text | Human-readable error. |
| retryCount | integer | Number of retry attempts. |
| nextRetryAt | integer | Unix timestamp (ms) for next retry. |

#### `blob_upload_queue`
Queue of blobs pending upload (supports offline queueing).

| Field | Type | Notes |
| --- | --- | --- |
| id | integer | Auto-increment PK. |
| snapshotId | text | FK → `local_snapshots.id`. |
| blobHash | text | SHA256 hash of blob content. |
| filePath | text | Repo-relative path. |
| size | integer | Blob size in bytes. |
| status | text | `pending`, `uploading`, `completed`, `failed`. |
| uploadedAt | integer | Unix timestamp (ms). |
| retryCount | integer | Number of retry attempts. |
| nextRetryAt | integer | Unix timestamp (ms) for next retry. |
| lastErrorCode | text | Error code if failed. |

#### `patch_queue`
Queue of patches pending application from server.

| Field | Type | Notes |
| --- | --- | --- |
| id | text | Patch UUID (from server). |
| snapshotId | text | FK → `local_snapshots.id`. |
| path | text | File path. |
| baseBlobHash | text | Expected hash before patch. |
| patchFormat | text | e.g., `unified`. |
| patchBody | text | Diff content. |
| status | text | `pending`, `applied`, `rejected`, `superseded`. |
| appliedAt | integer | Unix timestamp (ms). |
| rejectReason | text | Reason if rejected (e.g., `hash_mismatch`). |

#### `sync_metadata`
Global sync metadata and configuration.

| Field | Type | Notes |
| --- | --- | --- |
| key | text | PK (e.g., `schema_version`, `last_sync_at`). |
| value | text | JSON-encoded value. |
| updatedAt | integer | Unix timestamp (ms). |

Reserved keys:
- `schema_version`: Current schema version (integer).
- `last_sync_at`: Last successful sync timestamp.
- `dirty_flag`: Boolean indicating if repo has unseen changes.
- `auto_sync_enabled`: Boolean auto-sync config.
- `auto_sync_interval_ms`: Auto-sync interval in milliseconds.

## Offline Queueing Strategy

### Goals
- Support offline editing and snapshot creation.
- Queue uploads for later when network is unavailable.
- Persist patches from server until they can be applied.
- Provide clear feedback on queue status and errors.

### Upload Queue Behavior

#### Adding to Queue
1. User runs `markdowntown sync` (or auto-sync triggers).
2. CLI creates snapshot, computes manifest and blob hashes.
3. CLI attempts to call `POST /api/cli/snapshots` to handshake.
4. **If online:**
   - Server responds with `missingBlobs[]`.
   - CLI inserts missing blobs into `blob_upload_queue` with `status=pending`.
   - CLI begins uploading blobs sequentially or in parallel (configured).
5. **If offline:**
   - CLI stores snapshot metadata in `local_snapshots` with `status=pending`.
   - CLI inserts all blobs into `blob_upload_queue` with `status=pending`.
   - CLI sets `sync_metadata.dirty_flag = true`.
   - CLI displays: "Queued for sync when online (X files, Y MB)".

#### Processing Queue
1. Periodically (or on network reconnect), CLI checks `blob_upload_queue` for `status=pending`.
2. CLI attempts to upload each blob in order of insertion.
3. **On success:**
   - Mark blob `status=completed`, set `uploadedAt`.
   - Continue to next blob.
4. **On transient error (429, 5xx, timeout):**
   - Increment `retryCount`, set `nextRetryAt` using exponential backoff.
   - Mark blob `status=pending` (stays in queue).
   - Continue to next blob (or pause queue if error is persistent).
5. **On permanent error (400, 401, 403, 404):**
   - Mark blob `status=failed`, set `lastErrorCode`.
   - Mark snapshot `status=failed`.
   - Notify user: "Upload failed: [error message]".
6. **On all blobs completed:**
   - Call `POST /api/cli/snapshots/:id/finalize`.
   - Mark snapshot `status=ready`.
   - Clear `sync_metadata.dirty_flag`.

#### Retry Backoff
- **Initial delay:** 1 second
- **Max delay:** 5 minutes
- **Backoff multiplier:** 2x
- **Max retries:** 10 attempts
- **Formula:** `delay = min(initial * 2^(retryCount-1), maxDelay)`

Example progression:
1. 1s
2. 2s
3. 4s
4. 8s
5. 16s
6. 32s
7. 64s (1m 4s)
8. 128s (2m 8s)
9. 256s (4m 16s)
10. 300s (5m, capped at max)

### Queue Size Limits

To prevent unbounded growth during long offline periods:

| Limit | Default | Notes |
| --- | --- | --- |
| Max snapshots queued | 10 | Oldest snapshots auto-fail if exceeded. |
| Max blobs queued | 10,000 | Total across all snapshots. |
| Max queue size (bytes) | 5 GB | Total blob size in queue. |
| Max single blob size | 100 MB | Reject blobs exceeding this size. |

When limits are exceeded:
- **Soft limit (80% of max):** Warn user, continue queueing.
- **Hard limit (100%):** Reject new sync requests with clear error.
- **Overflow behavior:** Fail oldest pending snapshot and remove its blobs from queue.

### Patch Queue Behavior

#### Receiving Patches
1. User runs `markdowntown sync --pull-patches` (or auto after upload completes).
2. CLI calls `GET /api/cli/snapshots/:id/patches`.
3. **If online:**
   - CLI receives patches from server.
   - CLI inserts patches into `patch_queue` with `status=pending`.
4. **If offline:**
   - CLI skips patch pull (no error, silent).

#### Applying Patches
1. For each patch in `patch_queue` with `status=pending`:
   - Read local file at `path`.
   - Compute SHA256 hash of current content.
2. **If hash matches `baseBlobHash`:**
   - Apply patch using `git apply` or equivalent.
   - Mark patch `status=applied`, set `appliedAt`.
   - Notify user: "Applied patch: [path]".
3. **If hash does not match:**
   - Mark patch `status=rejected`, set `rejectReason=hash_mismatch`.
   - Notify user: "Conflict: [path] was modified locally. Patch rejected."
4. **If file does not exist:**
   - Mark patch `status=rejected`, set `rejectReason=file_not_found`.
   - Notify user: "Conflict: [path] was deleted locally. Patch rejected."

#### Conflict Resolution
- Rejected patches remain in `patch_queue` for user review.
- User can manually apply or discard rejected patches.
- User must upload a new snapshot after resolving conflicts to sync local changes.

## Schema Versioning

### Version Numbering
- Schema version is an integer stored in `sync_metadata.schema_version`.
- Initial version: `1`.
- Increment for any breaking change (column add/remove/rename, type change).

### Supported Versions
The CLI must support reading from older schema versions and migrating forward. The CLI **cannot** downgrade schema versions.

| Schema Version | CLI Version | Notes |
| --- | --- | --- |
| 1 | v0.1.0+ | Initial schema. |
| 2 | v0.2.0+ | Added `patch_queue.rejectReason`. |
| 3 | v0.3.0+ | TBD |

### Migration Strategy

#### On CLI Startup
1. Read `sync_metadata.schema_version` from local storage.
2. Compare to current schema version embedded in CLI binary.
3. **If local version == current version:** No migration needed.
4. **If local version < current version:** Run migrations sequentially.
5. **If local version > current version:** Error and refuse to run (downgrade not supported).

#### Migration Execution
- Migrations are SQL scripts executed in a transaction.
- Each migration file is named `migration_NNN_description.sql`.
- Migrations are applied in order, updating `schema_version` after each.

Example migration (v1 → v2):
```sql
-- migration_002_add_patch_reject_reason.sql
BEGIN TRANSACTION;

ALTER TABLE patch_queue ADD COLUMN rejectReason TEXT;

UPDATE sync_metadata SET value = '2', updatedAt = unixepoch('now', 'subsec') * 1000
WHERE key = 'schema_version';

COMMIT;
```

#### Rollback Safety
- If migration fails, transaction rolls back and CLI exits with error.
- User must manually fix corruption or delete `sync.db` to reset.
- Backup of `sync.db` is created before migration in `backup/` directory.

### Data Persistence vs Derived State

| Data | Persisted Locally | Derived from Server |
| --- | --- | --- |
| Snapshot metadata | Yes | Synced on finalize |
| Blob upload queue | Yes | - |
| Patch queue | Yes | Fetched from server |
| Manifest content | No | Recomputed on sync |
| File hashes | No | Computed on demand |
| Last sync timestamp | Yes | - |
| Dirty flag | Yes | - |

**Rationale:**
- Manifests and hashes are recomputed from local files to ensure correctness.
- Only sync state (queue, status, errors) is persisted.
- Server is source of truth for snapshot finalization and patches.

## Corruption Recovery

### Detection
- **Checksums:** Validate `sync.db` integrity using SQLite `PRAGMA integrity_check`.
- **Version mismatch:** Detect if `schema_version` is missing or invalid.

### Recovery Options
1. **Auto-repair:** If corruption is minor (e.g., orphaned rows), attempt to clean up.
2. **Backup restore:** If backup exists in `backup/`, restore and retry.
3. **Hard reset:** Delete `sync.db` and reinitialize (loses queued uploads).

### User Actions
- `markdowntown sync --doctor`: Run integrity check and auto-repair if possible.
- `markdowntown sync --reset-local`: Delete local storage and reinitialize (destructive).
- `markdowntown sync --export-queue`: Export queue to JSONL for debugging.

## Security Considerations

### Token Storage
- CLI auth tokens are stored in OS keychain/credential manager (not in `sync.db`).
- Only token metadata (expiry, refresh timestamp) is stored in local storage.

### Data at Rest
- Local storage is **not encrypted** by default.
- Users on multi-user systems should use OS-level file encryption.
- Future enhancement: Optional SQLite encryption (SQLCipher).

### Path Traversal
- All file paths in `blob_upload_queue` and `patch_queue` are validated to be relative to `repoPath`.
- Reject absolute paths, parent directory references (`..`), and symlink traversal.

## Performance Considerations

### Hash Caching
- File hashes are **not** persisted in local storage (recomputed on demand).
- In-memory cache during single sync operation to avoid redundant hashing.
- Future enhancement: Persist hashes keyed by `(path, mtime, size)` for fast dirty detection.

### Concurrent Access
- SQLite database uses `WAL` mode for better concurrency.
- Lock file prevents multiple CLI instances from syncing same repo simultaneously.
- Read operations do not block writes (except during migration).

### Database Size
- Queue rows are pruned after 30 days of completion/failure.
- Snapshots older than 90 days are archived or removed.
- `VACUUM` is run periodically to reclaim space.

## Testing Strategy

### Unit Tests
- Schema creation and migration logic.
- Queue insertion, update, and retrieval.
- Retry backoff calculation.
- Overflow limit enforcement.

### Integration Tests
- End-to-end sync with offline simulation.
- Patch application with conflict scenarios.
- Corruption recovery (manual corruption injection).

### Chaos Tests
- Simulate network failures during upload.
- Simulate disk full errors during queue writes.
- Simulate concurrent sync attempts (race conditions).

## Related Docs
- Protocol: `docs/architecture/sync-protocol.md`
- Data model: `docs/architecture/cli-sync-data-model.md`
- State machine: `docs/architecture/sync-state-machine.md`
