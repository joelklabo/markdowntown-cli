# Home FRE focus brief

Last updated: Dec 28, 2025
Owner: Product + UX

## Objective
Make the first-run experience obvious and fast: a scan-first path that gets users to a working agents.md in minutes.

## Primary message
"Scan your repo to see what instruction files load, then build and export agents.md in Workbench."

## CTA hierarchy
- Primary: **Scan a folder** → `/atlas/simulator`
- Secondary: **Open Workbench** → `/workbench`
- Tertiary: **Browse Library** → `/library` (only once, in hero or library preview)

## Required sections (keep)
1. **Hero**
   - Value statement (scan-first)
   - Primary + secondary CTAs
   - Optional tertiary "Browse Library" text link
2. **Quick-start steps**
   - 3 steps: Scan → Review → Export
   - Short copy per step (1 sentence max)
3. **Proof / Output preview**
   - One compact preview or quality signals
   - Reinforces export readiness
4. **Minimal Library preview**
   - Small curated grid (6 items max)
   - Single CTA: "Browse Library"
5. **Final CTA block**
   - Repeat scan-first CTA hierarchy
   - No new actions introduced

## Sections to remove or consolidate
- Multiple library grids (trending + new + template spotlight → single preview)
- Tag cloud section
- "Why sign in" box on home (move to Workbench or auth surfaces)
- Redundant features grid (keep only if it supports the scan-first story)

## Empty state behavior
- If no public items exist: show a lightweight empty state in the Library preview area.
- Do not replace or remove the hero/quick-start content.

## Mapping to primary flow
- Hero: entry into **Scan**
- Quick-start steps: Scan → Review → Export
- Proof/preview: confirms Workbench output
- Library preview: secondary discovery path
- Final CTA: reinforces Scan → Workbench

## Success signals
- Users understand the scan-first path without scrolling past the hero.
- Only one primary CTA per section.
- Mobile layout shows CTA hierarchy without overlap with bottom nav.

## Assumptions
- Home uses existing data sources (public items/tags/counters).
- No backend changes required.
- Copy uses existing terminology (Scan, Workbench, Library, Export).
