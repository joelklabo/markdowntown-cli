# CLI sync UX flow

## Goals
- Provide a clear path from CLI upload → web review → patch creation.
- Make patch handoff back to the CLI explicit and safe.
- Keep Workbench and CLI Sync distinct while sharing audit context.

## Information architecture (IA)
- Primary nav: Workbench · Library · Translate · Docs · **CLI Sync**.
- CLI Sync routes:
  - **Dashboard** → list of synced repos + snapshot status.
  - **Repo detail** → file tree + editor + issues panel + patch panel.
- Cross-links:
  - Repo detail → Workbench run summary (read-only) for deeper audit context.
  - Issues panel → rule docs / guidelines when available.

```
CLI Sync
├─ Dashboard
│  ├─ Connect CLI (if not authenticated)
│  └─ Repo cards (latest snapshot status)
└─ Repo detail
   ├─ File tree
   ├─ Editor
   ├─ Issues panel
   └─ Patch panel
```

## End-to-end flow
1. **Entry**: User opens CLI Sync dashboard and sees auth status.
2. **Connect**: If not authenticated, show CTA to run `markdowntown login`.
3. **Upload**: After `markdowntown sync upload`, dashboard lists the repo + snapshot.
4. **Review**: User opens repo detail to browse files and audit issues.
5. **Edit**: User edits a file in the web editor and previews changes.
6. **Create patch**: User saves changes and creates a patch.
7. **Apply locally**: Web shows patch ID + copyable CLI command:
   - `markdowntown pull --patch-id <id> --apply`
8. **Resync**: After apply, user uploads a new snapshot to reflect local state.

## Primary CTAs + copy
- **Connect CLI** (dashboard empty state): “Run `markdowntown login` to connect your CLI.”
- **Upload snapshot** (dashboard): “Run `markdowntown sync upload` to send a snapshot.”
- **Open repo** (repo card): “Open repo details.”
- **Create patch** (editor): “Create patch for CLI apply.”
- **Copy pull command** (patch panel): “Copy `markdowntown pull` command.”

## Empty + error states
- **No CLI auth**: “CLI not connected. Run `markdowntown login` to get started.”
- **No repos yet**: “No snapshots yet. Run `markdowntown sync upload`.”
- **No audit results**: “Audit pending. Refresh in a few minutes.”
- **Stale snapshot**: “Snapshot is older than your local repo. Upload a new snapshot.”
- **Large repos**: “Showing first N files. Use search or filters.”

## Error + recovery states
- **Network failure**: “Upload failed. Check your connection and retry.”
- **Auth expired (401/403)**: “Session expired. Run `markdowntown login` and retry.”
- **Rate limit / quota**: “Too many requests. Try again later.”
- **CLI version mismatch**: “CLI is out of date. Update to continue.”
- **Patch conflict**: “Patch does not apply cleanly. Resolve locally and re-upload.”

## Troubleshooting guidance
- Provide a short “What to try next” list for each error state.
- Link to CLI help output for `login`, `sync upload`, and `pull`.

## Privacy messaging
- Files are only uploaded when the user runs `markdowntown sync upload`.
- Web edits never auto-apply to local files; the CLI must pull patches.
- Snapshot metadata (hashes + timestamps) is stored to support audit + diff.

## Related docs
- Sync protocol: `../architecture/sync-protocol.md`
- Sync data model: `../architecture/cli-sync-data-model.md`
