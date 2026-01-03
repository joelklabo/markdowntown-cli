# Library flow UI spec

Date: 2025-12-28
Scope: Library list + preview drawer + handoff CTA.

## Goals
- Emphasize a single primary CTA: “Open in Workbench”.
- Make preview copy explicit about what will load.
- Provide a clear fallback when Library is empty.

## Primary entry points
- Global nav: Library → `/library`
- Home secondary CTA: Browse Library

## Layout and hierarchy
1. **Library list**
   - Card row: title, tool tag, brief summary, last updated.
   - Primary action on row: “Open in Workbench”.
   - Secondary action: “Preview”.
2. **Preview drawer**
   - Header: artifact title + tool badge.
   - Summary line: “Loads {tool} instructions into Workbench.”
   - Body: short description or snippet preview.
   - Primary CTA: “Open in Workbench”.
   - Secondary CTA: “Back to Library”.
3. **Empty state**
   - Title: “No artifacts yet”.
   - Body: “Scan a folder to generate your first artifact.”
   - Primary CTA: “Scan a folder”.

## CTA rules
- Only one primary CTA per surface.
- “Open in Workbench” is the primary CTA for list rows and preview.
- Empty state swaps the primary CTA to “Scan a folder”.

## Copy requirements
- “Open in Workbench” (primary action).
- “Loads this artifact into Workbench to export agents.md.” (preview helper)
- Use “AGENTS.md” for repo file and “agents.md” for export output.

## Error states
- **Load error:** show “Something went wrong” + “Try again”.
- **Artifact missing:** show “Artifact unavailable” + “Back to Library”.

## QA notes
- Verify CTA ordering and focus in keyboard navigation.
- Confirm empty state routes to `/atlas/simulator`.

## References
- docs/ux/library-first-flow.md
- docs/ux/primary-flow-spec.md
