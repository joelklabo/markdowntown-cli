# Workbench first-run + export guidance

Last updated: Dec 28, 2025

## Objective
Provide a calm, scan-aware onboarding path so first-time users know what to do next and how to export agents.md.

## Primary outcomes
- Users understand where their content comes from (scan context or templates).
- Users know the next action (add scopes/blocks, then export).
- Users feel safe: no repo content is uploaded; scan stays local-only.

## Entry states
### Entry matrix (state + focus + CTA)
- **Scan entry:** Atlas simulator → "Open Workbench".
  - State: scan defaults applied (tool + cwd/paths).
  - Initial focus: Export panel header or first missing required field.
  - Primary CTA: "Export agents.md".
- **Library entry:** Library → "Open in Workbench".
  - State: artifact content prefilled.
  - Initial focus: Export panel header.
  - Primary CTA: "Export agents.md".
- **Translate entry:** Translate → "Open in Workbench".
  - State: translated output prefilled.
  - Initial focus: Export panel header.
  - Primary CTA: "Export agents.md".
- **Direct entry:** /workbench without context.
  - State: empty workbench.
  - Initial focus: "Scan a folder" CTA.
  - Primary CTA: "Scan a folder".

### State handoff + conflict resolution
- If a new entry arrives and the current Workbench state is dirty, prompt to replace or cancel.
- If state is clean, replace with the new entry context.
- If the entry payload is invalid/malformed, show an error with "Retry" and "Start fresh" actions.

### Navigation + exit
- Back/exit should return to the originating surface when possible (Scan → Atlas, Library → Library).
- Direct entry uses browser back; provide a secondary CTA to "Browse Library" when empty.

## Page structure (first run)
1) **Header summary**
   - Title: "Build your agents.md"
   - Subtext: "Add scopes and blocks, then export."
2) **Context panel**
   - If scan exists: "Scan defaults applied" + tool + cwd/paths.
   - If Library/Translate entry: "Imported content ready" + source label.
   - If no scan: "No scan context yet" + CTA "Scan a folder".
3) **Next actions**
   - Primary: "Add scope" (or "Add block")
   - Secondary: "Import from Library" or "Translate instructions" when relevant.
4) **Export panel**
   - Primary CTA: "Export agents.md"
   - Helper: "Export writes a local agents.md file or copies to clipboard."

## Copy blocks (recommended)
### First-run hero
- Heading: "Build your agents.md"
- Helper: "Add scopes and blocks, then export when ready."

### Scan context (with scan)
- Heading: "Scan defaults applied"
- Helper: "Local-only scan. Nothing leaves your device."
- Detail line: "{tool} · cwd {path}" or list of scan paths.

### No scan context
- Heading: "No scan context yet"
- Helper: "Scan a folder to see which instruction files load and prefill Workbench."
- CTA: "Scan a folder"

### Export guidance
- Heading: "Export agents.md"
- Helper: "Copy or save a local agents.md file for your tool."

## Success and empty states
- **After export**: "Export complete. agents.md is ready."
- **Empty workbench**: "Add a scope or block to start building."
- **Invalid handoff**: "We couldn't load that context. Try again or start fresh."

## Edge cases
- Scan context present but missing files: keep CTA "Open Workbench" and show a note "Some instruction files are missing."
- Multiple targets: prompt to select a target before export.
- Mobile view: ensure primary CTA remains visible above the fold and safe-area compliant.

## Accessibility + motion
- Initial focus targets must match the entry matrix above.
- Respect `prefers-reduced-motion` for entry transitions or success animations.

## Notes
- Use consistent terms: Scan, Workbench, Library, Translate, Export.
- Do not mention "builder" in any user-facing copy.
