# CLI sync wireframe notes

## Dashboard
- **Header**: “CLI Sync” + auth status pill (Connected / Not connected).
- **Primary CTA** (if disconnected): “Run `markdowntown login` to connect.”
- **Repo list** (cards or table):
  - Repo name + provider badge.
  - Latest snapshot status (Ready / Pending / Error).
  - Last upload timestamp.
  - CTA: “Open repo”.
- **Empty state**: “No snapshots yet. Run `markdowntown sync upload`.”

## Repo detail
- **Top bar**: Repo name + snapshot ID + status + “Upload new snapshot” hint.
- **Layout**: 3-column split.
  - **Left**: File tree + search/filter.
  - **Center**: Editor (tabs optional) + diff toggle.
  - **Right**: Issues panel (severity filters + counts).
- **Patch panel** (drawer or footer):
  - Change summary.
  - CTA: “Create patch”.
  - After creation: patch ID + copy pull command.

## Editor interactions
- Save is explicit (no auto-save to patch).
- When unsaved changes exist, show a subtle banner: “Unsaved edits.”
- After patch creation, show “Patch ready for CLI apply.”

## Issues panel
- Summary chips: Error / Warning / Info.
- Item row: rule ID, short title, file path, link to rule docs.
- “Open in Workbench” link for full audit context.

## Empty + error states
- **No issues**: “No issues found for this snapshot.”
- **Missing audit**: “Audit pending. Check back soon.”
- **Snapshot error**: “Snapshot failed to process. Re-upload.”

## Error banners
- **Network**: “Connection lost. Retry upload.”
- **Auth expired**: “Session expired. Run `markdowntown login`.”
- **Rate limit**: “Too many requests. Try again later.”
- **CLI version**: “Update CLI to continue.”

## Accessibility + feedback
- Keyboard focus order: tree → editor → issues → patch panel.
- Toasts for patch creation and copy command.
