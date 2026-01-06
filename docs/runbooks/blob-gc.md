# Blob Garbage Collection Runbook

## Overview

Blobs are content-addressable storage records keyed by SHA-256 hash. They are automatically garbage collected when no `SnapshotFile` records reference them.

## Cleanup Mechanism

Blob GC runs as part of the `cleanupStaleUploads()` function in `apps/web/src/lib/cli/cleanup.ts`.

### When it runs

- Triggered by admin cleanup endpoint or scheduled cron job
- Also runs during stale upload cleanup (snapshots stuck in UPLOADING status)

### What it does

1. Deletes stale UPLOADING snapshots older than the configured threshold
2. Deletes orphaned blobs with no `SnapshotFile` references:
   ```sql
   DELETE FROM Blob WHERE NOT EXISTS (
     SELECT 1 FROM SnapshotFile WHERE SnapshotFile.blobId = Blob.id
   )
   ```

## Safety Guardrails

- **Soft reference check**: Only blobs with zero `SnapshotFile` references are deleted
- **Cascade-safe**: When a `Snapshot` is deleted, its `SnapshotFile` records are cascade-deleted first, leaving orphaned blobs for the next GC run
- **Audit logging**: All cleanup runs are logged via `logAuditEvent` with counts

## Edge Cases

- **Concurrent uploads**: Blobs created during upload but not yet linked to a `SnapshotFile` could be orphaned if the upload is interrupted. The stale upload cleanup handles this by waiting for the configured `maxAgeHours` threshold.
- **Shared blobs**: Multiple snapshots may reference the same blob (content-addressable). A blob is only deleted when ALL referencing `SnapshotFile` records are gone.

## Monitoring

Check cleanup results in logs:

```json
{ "event": "blob_gc_cleanup", "metadata": { "blobCount": 42 } }
```

## Manual Trigger

```bash
# Via admin API (if enabled)
curl -X POST https://api.example.com/api/admin/cli-cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
