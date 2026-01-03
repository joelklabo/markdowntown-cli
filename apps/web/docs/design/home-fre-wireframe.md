# Home FRE wireframe + component inventory

Last updated: Dec 28, 2025

## Layout order (desktop + mobile)
1. Hero (scan-first value + primary/secondary CTAs)
2. Quick-start steps (Scan → Review → Export)
3. Proof / output preview (quality signals)
4. Minimal Library preview (curated grid + single CTA)
5. Final CTA block (repeat Scan/Workbench hierarchy)

## Wireframe notes
### Hero
- Eyebrow: "Scan-first"
- Headline: "Scan your repo. See which instructions load."
- Subhead: 1–2 sentences max.
- CTAs:
  - Primary: Scan a folder
  - Secondary: Open Workbench
  - Tertiary: Browse Library (text link, optional)

### Quick-start steps
- 3 steps, numbered.
- Keep each step to 1 short sentence.
- Ends with Workbench CTA only if hero already includes Workbench button.

### Proof / output preview
- Small card or surface showing "agents.md ready" plus 3–4 quality signals.
- Avoid duplicating full Workbench preview.

### Minimal Library preview
- Max 6 items.
- Single CTA: "Browse Library".
- Empty state: short prompt to scan + link to Library.

### Final CTA block
- Repeat Scan (primary) + Workbench (secondary).
- No new CTAs.

## Component inventory
### Existing primitives
- `Container`, `Surface`, `Card`, `Stack`, `Row`, `Heading`, `Text`, `Button`, `Pill`

### New home-specific components (planned)
- `HomeSectionHeader`: eyebrow + title + optional description
- `HomeStepList`: numbered steps with compact spacing
- `HomeCtaCluster`: primary/secondary CTA pair + optional tertiary link

## Responsive guidance
- Mobile: keep CTA cluster stacked (primary first) with bottom nav clearance.
- Avoid multi-column grids above the fold on small screens.
- Preview cards should wrap to a single column below 768px.

## Copy map (initial)
- Hero eyebrow: "Scan-first"
- Hero headline: "Scan your repo. See which instructions load."
- Hero subhead: "Review insights, refine in Workbench, and export agents.md with confidence in minutes."
- Step labels: "Scan a folder", "Review insights", "Build & export"
- Proof callout: "Structured agents.md, ready to export"

## Notes
- Remove redundant home sections (tags cloud, multiple library grids, "Why sign in").
- Ensure home still reads well when public items are empty.
