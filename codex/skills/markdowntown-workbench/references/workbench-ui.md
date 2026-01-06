# Workbench UI + state references

## Core entry points
- `src/app/workbench/page.tsx` loads template + renders `WorkbenchPageClient`.
- `src/components/workbench/WorkbenchPageClient.tsx` wires Workbench header + panels, applies scan context.
- `src/hooks/useWorkbenchStore.ts` owns Workbench state, UAM normalization, targets, scan context.

## Panels (high-traffic)
- `src/components/workbench/WorkbenchHeader.tsx`
- `src/components/workbench/ExportPanel.tsx`
- `src/components/workbench/OutputPanel.tsx`
- `src/components/workbench/EditorPanel.tsx`
- `src/components/workbench/ScopesPanel.tsx`
- `src/components/workbench/BlocksPanel.tsx`
- `src/components/workbench/PreviewPanel.tsx`
- `src/components/workbench/DiffPanel.tsx`
- `src/components/workbench/LintPanel.tsx`
- `src/components/workbench/WorkbenchOnboardingCard.tsx`

## Store responsibilities (useWorkbenchStore)
- Normalizes UAM v1, ensures global scope, syncs legacy fields.
- Maintains selection state for scope + block.
- Manages scan handoff (`applyScanContext`, `SCAN_TOOL_TARGET_MAP`).
- Stores compilation results for the Export panel.

## UX docs
- `docs/ux/current-flow-audit.md` (Workbench gaps + CTA guidance)
- `docs/ux/skills-section-flow.md` (Skills → Workbench handoff)
- `docs/ux/microcopy-guidelines.md` (consistent labels)
