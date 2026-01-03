# Core Flow Handoff Contract

## Purpose
Define the client-only contract for handing off context from Scan, Library, and Translate into Workbench while preserving user intent across refresh and back navigation.

## Scope
- Client-only handoff (no server persistence).
- Primary surfaces: Scan (/atlas/simulator), Library (/library), Translate (/translate), Workbench (/workbench).
- Export target: agents.md.

## Handoff Principles
- **Minimal URL payloads:** URLs may include scan defaults (tool, cwd, small path list) but must stay under a small size budget.
- **Local persistence:** Use sessionStorage for short-lived drafts.
- **Privacy-first:** Do not include file contents in URLs; analytics must redact paths/cwd.
- **Graceful failure:** If handoff data is missing/invalid, present a clear recovery CTA.

## Data Contract (Draft)

### Common fields
- `handoffId` (string, required): unique per handoff to avoid collisions across tabs.
- `source` (enum: scan | library | translate, required)
- `timestamp` (ISO string, required)
- `version` (string, required) — schema version for backward compatibility.

### Scan context payload
- `toolId` (string)
- `cwd` (string, redacted in analytics)
- `paths` (string[]; file paths; included in URL only when small)
- `loadedCount` (number)
- `missingCount` (number)
- `warnings` (string[])

### Library context payload
- `artifactId` (string)
- `artifactTitle` (string)
- `artifactType` (string)
- `artifactVersion` (string | null)

### Translate context payload
- `inputType` (string)
- `targetIds` (string[])
- `outputFiles` (array of { path: string; size: number })
- `compileStatus` (success | error)

## Persistence Strategy

### URL params
- `scanTool`, `scanCwd`, `scanPaths` (JSON array) used for small scan payloads.
- Query string budget target: ~1.8KB. If exceeded, fall back to sessionStorage.
- Paths are de-duped and capped to 200 entries before any URL usage.
- No file contents in URLs.

### sessionStorage
- Scan key: `workbench-scan-context-v1`.
- Workbench reads sessionStorage on entry; scan handoff links set `scanStored=1` as a hint.
- Stored scan payload includes tool, cwd, and paths; payloads are truncated if too large.
- Other handoffs should use their own versioned keys with the same size safeguards.
- Expiration: clear on export success or after 24 hours.

### Large payloads
- If the serialized scan payload exceeds ~250KB, truncate paths to 50 entries; if still too large, store tool + cwd with empty paths.
- Scan UI shows a warning when truncation occurs so users know to rescan a smaller folder.

## Back/Forward Behavior
- Back from Workbench should return to the originating surface when possible.
- Preserve scroll position in Library and Translate when returning.
- If history state is missing, fall back to the surface root route.

## Validation & Error Handling
- Validate payloads on Workbench entry (schema version + required fields).
- If invalid or missing, show a banner: "We couldn't load that context. Start a new Scan, pick a Library item, or Translate again."
- Provide primary CTA based on `source` (Scan a folder, Browse Library, Open Translate).

## Telemetry (Privacy-safe)
- Track handoff success/failure events without paths/cwd:
  - `workbench_handoff_start`
  - `workbench_handoff_success`
  - `workbench_handoff_failed` (reason: missing | invalid | too_large)

## Risks
- sessionStorage size limits (~5MB per origin) may fail for large scans.
- Multiple tabs can overwrite data without unique `handoffId` keys.
- Client-only storage is not shareable; deep links will not carry full context.

## Open Questions
- Should large payloads use IndexedDB to avoid sessionStorage limits?
- Do we need a short-lived server draft ID for shareable links?
