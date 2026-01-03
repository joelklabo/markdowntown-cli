# Scan → Workbench UX Narrative

Date: 2025-12-28
Scope: Atlas Simulator scan experience and the handoff into Workbench.

## Purpose
Help first-time users understand what the scan does, what it found, and the single next step to export agents.md in Workbench.

## Core narrative
1. **Local-first scan**
   - Headline: “Scan a folder”
   - Supporting copy: “Scans run locally in your browser. File contents never leave your device.”
2. **Clear results**
   - Summarize what loaded, what’s missing, and what’s extra.
   - Use action-oriented language (“Fix missing root file”, “Switch tool”, “Set cwd”).
3. **Single next step**
   - When results are ready, the primary CTA is **Open Workbench**.
   - Secondary actions help resolve issues (copy template, adjust cwd, rescan).

## CTA rules
- Only one primary CTA per state.
- Ready state → **Open Workbench**.
- Error state → primary CTA fixes the top issue; **Open Workbench** is hidden or disabled until ready.
- Warning state → primary CTA addresses the warning; **Open Workbench** can appear as secondary with a caution label when non-blocking (e.g., “Open Workbench anyway”).

## Copy guidelines
- Always distinguish **AGENTS.md** (repo instruction file) vs **agents.md** (export output).
- Use short, imperative phrasing (“Copy template”, “Set cwd”, “Open Workbench”).
- Reinforce local-only scanning at least once above the scan CTA or in the results header.
- Use explicit privacy copy: “File contents never leave your device.”

## Recovery messaging
- **Permission denied**: “Access denied. Allow folder access to run the scan.”
- **Empty scan**: “No instruction files found. Add a root instruction file to proceed.”
- **Mixed tools**: “Multiple formats detected. Pick the tool you want to load.”
- **Truncated scan**: “Large repo detected. Scan a smaller folder or continue with partial results.”

## Success indicators
- Users see the “Open Workbench” CTA after a successful scan.
- Users understand that scans are local-only.
- Users can export agents.md within minutes of scanning.

## Related docs
- `docs/atlas/scan-next-steps.md`
- `docs/ui/scan-flow.md`
