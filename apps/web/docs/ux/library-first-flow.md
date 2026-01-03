# Library-first flow spec

Date: 2025-12-28
Owner: UX

## Objective
Make Library a fast path to value: pick a public artifact, preview what it contains, open in Workbench, export agents.md.

## Primary flow (happy path)
1. **Browse Library**
   - Users scan a list of artifacts with clear titles, tool tags, and short summaries.
2. **Preview an artifact**
   - Preview drawer shows what will load in Workbench (files, tool target, last update).
3. **Open in Workbench**
   - Primary CTA: “Open in Workbench”.
   - Workbench loads artifact context and points to export.
4. **Export**
   - Users export or copy the resulting agents.md.

## CTA hierarchy
- **Primary:** Open in Workbench
- **Secondary:** Copy summary / View details (if available)
- **Tertiary:** Browse another artifact

## Validation + empty/error states
- **Empty library:** Explain no artifacts found and route users to Scan.
- **Load error:** Provide a single “Try again” action.
- **Missing artifact content:** Show “Artifact unavailable” and return to Library list.

## Copy + terminology
- Use “Library” as the surface label.
- Use “Open in Workbench” for the primary action.
- Clarify what opens: “This loads the artifact instructions into Workbench.”
- Distinguish **AGENTS.md** (repo instruction file) vs **agents.md** (export output).

## Edge cases
- Empty Library should point to Scan as the next best path.
- Long summaries should truncate without hiding the primary CTA.

## References
- docs/ux/primary-flow-spec.md
- docs/ux/microcopy-guidelines.md
