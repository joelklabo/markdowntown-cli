# Translate flow UI spec

Date: 2025-12-28
Scope: Translate page and post-translate handoff CTA.

## Goals
- Make Translate a fast conversion step with a clear Workbench handoff.
- Keep a single primary CTA at each step.
- Communicate what will open in Workbench after conversion.

## Primary entry points
- Global nav: Translate → `/translate`
- Library/Workbench secondary links (where applicable)

## Layout and hierarchy
1. **Header**
   - Title: “Translate markdown into agent-ready formats”.
   - Helper: short line explaining conversion to Workbench export.
2. **Input panel**
   - Text area for Markdown/UAM input.
   - Helper text: input expectations and privacy note.
3. **Targets panel**
   - Target checkboxes + detected badge.
   - Advanced options toggle for adapter versions and JSON.
4. **Results + next step**
   - Success summary: “Generated {n} files”.
   - Primary CTA: “Open in Workbench”.
   - Secondary CTA (optional): “Download zip”.

## CTA rules
- One primary CTA at a time.
- “Translate” is primary until results are ready.
- “Open in Workbench” becomes primary after success.
- “Download zip” is secondary and optional.

## Copy requirements
- “Translate” (primary action).
- “Open in Workbench” (post-success CTA).
- “Opens in Workbench for export” (success helper line).
- Use “AGENTS.md” for repo file and “agents.md” for export output.

## Error states
- **No targets selected:** inline callout + disabled primary CTA.
- **Empty input:** helper text + disabled primary CTA.
- **Compile error:** single retry CTA with short error text.

## QA notes
- Verify CTA swaps after success.
- Confirm Workbench opens with translated files.
- Check keyboard focus order and visible focus states.

## References
- docs/ux/translate-flow.md
- docs/ux/primary-flow-spec.md
