# Site UX Audit + Priorities (2025 Refresh)

Date: 2025-12-20
Reviewer: Codex
Scope: Global shell, Home, Library/Browse, Cards, Builder, Workbench, Atlas, Simulator, Docs/Changelog, Privacy/Terms, Auth, Translate, Detail pages
Breakpoints: Desktop (>= 1280px), Tablet (>= 768px), Mobile (< 768px), Small Mobile (<= 360px)

## Method
- Heuristic review (clarity, hierarchy, spacing, consistency, affordances).
- Mobile-first pass to flag overflow, cramped controls, and thumb reach.
- Motion/accessibility pass (focus, reduced motion, contrast, target sizes).
- Performance sanity check (CLS/INP/LCP awareness).

## Legend
- Severity: P0 blocking, P1 high, P2 medium, P3 low
- Type: Hierarchy, Spacing, Consistency, Accessibility, Motion, Content, Performance

## Palette + Component Polish (2025)
- References: `docs/design/palette-refresh.md`, `docs/design/component-polish-2025.md`
- Goal: align component states (hover/active/focus/disabled) with refreshed palette tokens.
- Emphasis: dark mode state contrast, consistent borders, and predictable elevation tiers.

## Global Shell (Nav + Footer)
1) Banner + nav stack feels visually dense on desktop; minimal breathing room between banner, nav row, and page hero. (P2, Spacing)
   - Targets: `src/components/SiteNav.tsx`, `src/app/layout.tsx`
   - Fix: Add vertical rhythm between banner and nav row; unify header height across pages.

2) Mobile nav + overflow menu controls are visually similar; primary CTA does not stand out. (P2, Hierarchy)
   - Targets: `src/components/SiteNav.tsx`
   - Fix: Promote primary action with tone/size and simplify mobile command/search entry.

3) Footer hierarchy is flat; link groups scan as a wall of text on mobile. (P3, Hierarchy)
   - Targets: `src/components/Footer.tsx`
   - Fix: Introduce grouped headings, clearer spacing, and improved column stacking.

## Home / Landing
1) Hero CTA cluster competes with adjacent content (search + cards). (P2, Hierarchy)
   - Targets: `src/app/page.tsx`
   - Fix: Tighten hero CTA cluster and separate from secondary content with spacing.

2) Empty state reads as a generic card; lacks a clear next-step path. (P2, Content)
   - Targets: `src/app/page.tsx`
   - Fix: Add explicit empty-state guidance and a single clear CTA.

## Library + Browse
1) Filter/search area has uneven spacing; pills and search input feel ungrouped. (P2, Consistency)
   - Targets: `src/app/library/page.tsx`, `src/app/browse/page.tsx`, `src/components/browse/BrowseSearch.tsx`, `src/components/browse/BrowseFilterPills.tsx`
   - Fix: Align filters into a single stack with consistent padding and section labels.

2) Result grid density is inconsistent between library and browse pages. (P2, Consistency)
   - Targets: `src/components/browse/BrowseResults.tsx`
   - Fix: Standardize grid spacing and card sizing to reduce layout drift.

## Cards + Actions
1) Card metadata hierarchy is shallow; action buttons compete with titles. (P2, Hierarchy)
   - Targets: `src/components/LibraryCard.tsx`, `src/components/snippet/SnippetActions.tsx`, `src/components/template/TemplateActions.tsx`
   - Fix: Raise title prominence, move actions to a consistent corner/row.

2) Mobile touch targets for card actions are tight. (P1, Accessibility)
   - Targets: same as above
   - Fix: Enforce >= 24px min target size and comfortable padding.

## Builder
1) Status + save indicators appear as secondary text but are visually noisy near primary actions. (P2, Hierarchy)
   - Targets: `src/components/BuilderStatus.tsx`, `src/components/BuilderClient.tsx`
   - Fix: Reduce visual weight, group status as a subtle badge or footer line.

2) Mobile layout risks horizontal overflow in builder panels. (P1, Accessibility)
   - Targets: `src/app/builder/page.tsx`, `src/components/BuilderClient.tsx`
   - Fix: Stack controls and reduce fixed-width elements.

## Workbench
1) Panel spacing and padding feel inconsistent between editor, output, and lint panels. (P2, Consistency)
   - Targets: `src/components/workbench/*Panel.tsx`
   - Fix: Normalize panel paddings and section headers.

2) Long content (diffs/lints) can push the header off screen without a clear anchor. (P2, Usability)
   - Targets: `src/components/workbench/WorkbenchHeader.tsx`, `src/app/workbench/page.tsx`
   - Fix: Add sticky header or ensure primary actions remain reachable.

## Atlas + Simulator
1) Atlas landing has dense card grid; headers and meta are tight. (P2, Spacing)
   - Targets: `src/app/atlas/page.tsx`, `src/components/atlas/AtlasHeader.tsx`
   - Fix: Increase card padding and add breathing room around header.

2) Simulator inputs and results feel crowded on mobile; scanning insights is difficult. (P2, Hierarchy)
   - Targets: `src/components/atlas/ContextSimulator.tsx`, `src/components/atlas/SimulatorInsights.tsx`
   - Fix: Group inputs with clear labels; separate results visually.

## Docs + Changelog
1) Docs landing uses small type and tight line-height; scanning is harder than needed. (P2, Readability)
   - Targets: `src/app/docs/page.tsx`
   - Fix: Increase type scale and line-height; add spacing between sections.

2) Changelog entries lack clear visual rhythm for date/title/body. (P3, Hierarchy)
   - Targets: `src/app/changelog/page.tsx`
   - Fix: Add consistent entry spacing and typographic hierarchy.

## Privacy + Terms
1) Policy pages are dense walls of text; low scannability on mobile. (P2, Readability)
   - Targets: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
   - Fix: Increase line-height, add section spacing, and improved headings.

## Auth
1) Sign-in layout feels visually disconnected from the main shell; hierarchy is unclear. (P2, Consistency)
   - Targets: `src/app/signin/page.tsx`, `src/components/auth/*`
   - Fix: Align layout spacing and header tone with the main shell.

## Translate
1) Upload + output controls are tightly grouped; needs clearer separation for scan flow. (P2, Hierarchy)
   - Targets: `src/app/translate/page.tsx`, `src/components/translate/*`
   - Fix: Introduce a two-step visual flow: input > settings > output.

## Detail Pages
1) Title and metadata spacing are cramped; header looks like a card rather than a hero. (P2, Hierarchy)
   - Targets: `src/app/a/[slug]/page.tsx`, `src/app/snippets/[slug]/page.tsx`, `src/app/templates/[slug]/page.tsx`
   - Fix: Increase top spacing and emphasize titles to match landing cadence.

## Accessibility + Motion
1) Focus indicators and hover states vary across components. (P2, Consistency)
   - Targets: `src/components/ui/*`, `src/app/globals.css`
   - Fix: Centralize focus ring styles with semantic tokens.

2) Motion is not clearly documented; reduced-motion behavior should be explicit. (P2, Motion)
   - Targets: `docs/design/motion-responsive.md`, `src/app/globals.css`
   - Fix: Define motion tokens and reduced-motion fallbacks.

## Quick Wins (Top 10)
1) Add vertical rhythm between banner/nav and page heroes.
2) Normalize filter/search spacing across library + browse.
3) Increase card action touch targets on mobile.
4) Standardize panel padding across workbench panels.
5) Improve docs/changelog type scale and spacing.
6) Clarify builder status placement to reduce noise.
7) Clean up mobile overflow in builder/workbench layouts.
8) Enhance footer grouping and spacing.
9) Add clear empty-state guidance on home.
10) Normalize focus ring styles across UI primitives.

## Deeper Improvements (Top 10)
1) Create a unified spacing/motion token system with documented usage.
2) Introduce a consistent card/action layout across library + detail pages.
3) Harmonize nav, tabs, and pill components for a single interaction language.
4) Rework Atlas simulator input/output separation for mobile-first flow.
5) Add a responsive layout spec for all primary surfaces.
6) Update auth layout to align with main shell and reduce visual drift.
7) Build a reusable hero pattern for landing and detail pages.
8) Improve content density rules (line length, spacing) for long-form pages.
9) Add UX telemetry (CTA clicks, search usage, drop-off) to validate changes.
10) Extend E2E coverage for responsive layout and focus behavior.

## Acceptance Benchmarks
- Accessibility:
  - All interactive controls have visible focus states.
  - Touch targets meet minimum size and spacing expectations.
  - Contrast remains above minimum thresholds for body and UI text.
  - Reduced-motion preference disables non-essential motion.
- Performance:
  - LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 (p75).
  - No layout shift introduced by new spacing/motion.
- Usability:
  - Primary CTA on home is visible within first viewport on mobile.
  - Library/browse filters can be used without horizontal scrolling.
  - Builder/workbench primary actions remain reachable on scroll.

## Measurable UX Success Signals
1) Increase in home CTA click-through rate.
2) Higher library search usage per session.
3) Reduced mobile bounce rate on library and builder flows.
4) Reduced time-to-first-action (CTA click, search, or create).
5) Improved task completion rate for builder/workbench exports.
6) Lower support/feedback mentions of “hard to find” or “confusing layout”.

## Refactoring Opportunities / Follow-ups
- Consider consolidating shared spacing and layout utilities for cards and panels.
- Evaluate a shared “hero” component for landing + detail pages.
- Audit nav/pill/tab components for shared interaction patterns.
