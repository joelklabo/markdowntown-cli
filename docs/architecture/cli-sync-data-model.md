# CLI sync data model (CAS + patches)

## Summary
Define the entities and relationships for repo snapshots, CAS blobs, patches, and audit issues. Models assume Postgres with indexed lookup by repo, snapshot, and blob hash.

## Entities

### Repo
Represents a unique repository synced by the CLI.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| slug | text | Stable identifier (owner/name or local alias). |
| provider | text | e.g., local, github (optional). |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

Indexes:
- `unique(slug)`

### Snapshot
Immutable point-in-time view of a repo.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| repoId | uuid | FK → Repo. |
| baseSnapshotId | uuid | Optional FK for delta uploads. |
| manifestHash | text | Hash of ordered manifest. |
| protocolVersion | text | Negotiated protocol version. |
| idempotencyKey | text | Client request id for safe retries. |
| status | text | `created`, `uploading`, `ready`, `failed`. |
| createdAt | timestamptz | |
| finalizedAt | timestamptz | |

Indexes:
- `index(repoId, createdAt)`
- `index(manifestHash)`

### FileBlob
Content-addressed file blob.

| Field | Type | Notes |
| --- | --- | --- |
| hash | text | `sha256` of content (PK). |
| size | bigint | Bytes. |
| createdAt | timestamptz | |

Indexes:
- `primary(hash)`

### SnapshotFile
Join table between Snapshot and FileBlob (manifest entry).

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| snapshotId | uuid | FK → Snapshot. |
| path | text | Repo-relative path. |
| blobHash | text | FK → FileBlob. |
| size | bigint | Bytes. |
| mode | int | File mode bits. |
| mtime | timestamptz | Source mtime. |
| orderIndex | int | Deterministic ordering. |
| isDeleted | boolean | Tombstone marker for deleted files. |
| deletedAt | timestamptz | Optional deletion timestamp. |

Indexes:
- `index(snapshotId, orderIndex)`
- `index(snapshotId, path)`

### Patch
Diff generated from web edits.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| snapshotId | uuid | FK → Snapshot. |
| path | text | File path. |
| baseBlobHash | text | Expected hash before patch. |
| patchFormat | text | e.g., unified diff. |
| patchBody | text | Diff content. |
| status | text | `proposed`, `applied`, `rejected`, `superseded`. |
| idempotencyKey | text | Prevent duplicate apply on retries. |
| createdAt | timestamptz | |
| appliedAt | timestamptz | |

Indexes:
- `index(snapshotId, status)`
- `index(snapshotId, path)`

### AuditIssue
Issue produced by scan/audit for a snapshot.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| snapshotId | uuid | FK → Snapshot. |
| ruleId | text | Rule identifier. |
| severity | text | `info`, `warning`, `error`. |
| path | text | File path. |
| message | text | Human-readable summary. |
| createdAt | timestamptz | |

Indexes:
- `index(snapshotId, severity)`
- `index(snapshotId, ruleId)`

## Relationships
- Repo has many Snapshots.
- Snapshot has many SnapshotFiles and AuditIssues.
- SnapshotFile references FileBlob.
- Snapshot has many Patches.

## Lifecycle states
- Snapshot: `created` → `uploading` → `ready` or `failed`.
- Patch: `proposed` → `applied` or `rejected` (or `superseded`).
- AuditIssue: `open`/`dismissed`/`resolved` (status stored in UI layer if needed).
