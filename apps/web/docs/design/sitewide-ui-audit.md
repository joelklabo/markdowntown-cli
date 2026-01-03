# Sitewide UI Audit (Living City Refresh)

Date: 2025-12-20
Reviewer: Codex
Scope: Home, Library/Browse, Detail, Workbench/Builder, Translate, Atlas/Docs, Auth
Breakpoints: Desktop (>= 1024px), Tablet (>= 768px < 1024px), Mobile (< 768px)

## Legend
- Severity: P0 (blocking), P1 (high), P2 (medium), P3 (low)
- Type: Spacing, Alignment, Visual hierarchy, Contrast, Component consistency, Motion, Accessibility

## Status updates
- 2025-12-29: Component recipes + states documented in `docs/design/component-recipes.md`. Implementation still pending across surfaces.

## Global / Header / Footer
1) Header wordmark appears clipped at the very top edge on desktop (banner touches viewport edge; no vertical breathing room). (P2, Spacing)
   - Target: `src/components/SiteNav.tsx`, `src/app/globals.css`
   - Proposed fix: add 2–4px vertical padding or adjust banner height/preserveAspectRatio so skyline doesn't clip. Ensure same on light/dark.

2) Header search row is visually dense vs. hero banner; spacing between banner and nav row is tight. (P2, Spacing)
   - Target: `src/components/SiteNav.tsx`
   - Proposed fix: add a subtle separation (extra `py` or divider) so banner reads as distinct hero strip.

3) Footer is visually distant from header theme; palette feels neutral and detached. (P3, Visual cohesion)
   - Target: `src/components/Footer.tsx`, `src/app/globals.css`
   - Proposed fix: subtle background tone pulled from header night palette or introduce muted grid texture.

4) Mobile header compresses primary actions: command + search + menu are tight and visually similar. (P2, Component consistency)
   - Target: `src/components/SiteNav.tsx`, `src/app/globals.css`
   - Proposed fix: stronger icon button affordances or a single combined search/command entry with clearer emphasis.

## Home
1) Hero card content feels floating with minimal top spacing beneath the header. (P2, Spacing)
   - Target: `src/app/page.tsx`
   - Proposed fix: increase top padding or add subtle section separator under header.

2) “Nothing public yet” card shadow/outline is light vs. updated header contrast. (P3, Visual hierarchy)
   - Target: `src/components/ui/Card.tsx`, `src/app/globals.css`
   - Proposed fix: tune border/shadow tokens to align with header depth.

3) Home sections feel repetitive (multiple library grids + tags cloud). (P2, Visual hierarchy)
   - Target: `src/app/page.tsx`
   - Proposed fix: consolidate into a scan-first narrative (hero, steps, proof, minimal library preview, final CTA).
   - Note (Dec 28, 2025): landing will be reduced to the 3 core flows with a single primary CTA per section.

## Library / Browse
1) Filter sidebar padding is inconsistent: header spacing and input spacing are tight. (P2, Spacing)
   - Target: `src/app/library/page.tsx`, `src/components/library/FiltersPanel.tsx` (or equivalent)
   - Proposed fix: normalize vertical rhythm and align with card spacing tokens.

2) Filter chips (Type/Targets/Scopes) are visually small; spacing between groups is cramped. (P3, Visual hierarchy)
   - Target: `src/components/library/FilterChips.tsx`
   - Proposed fix: increase chip padding and add group labels with stronger type.
   - Status (Dec 29, 2025): sizing guidance documented in component recipes; apply in implementation pass.

## Detail Pages
1) Title and metadata spacing feels crowded at top; same spacing as generic cards. (P2, Spacing)
   - Target: `src/app/a/[slug]/page.tsx`
   - Proposed fix: add hero-style padding for title block; align with header rhythm.

2) Tab picker alignment / indicator feels inconsistent with header nav underline. (P2, Component consistency)
   - Target: `src/components/ui/Tabs.tsx` (or equivalent)
   - Proposed fix: adopt a single active indicator style and height across nav + tabs.
   - Status (Dec 29, 2025): tab states documented; needs code alignment.

## Workbench / Builder
1) Workbench header row (title + status + actions) is cramped; action chips and save button align awkwardly. (P2, Alignment)
   - Target: `src/app/workbench/page.tsx`, `src/components/builder/Header.tsx`
   - Proposed fix: align actions baseline, add consistent spacing around inputs.

2) Left rail (Scopes/Blocks) has uneven spacing between section headers and controls. (P2, Spacing)
   - Target: `src/components/builder/ScopesPanel.tsx`, `src/components/builder/BlocksPanel.tsx`
   - Proposed fix: normalize section spacing to match filter sidebar style.

3) Tabs (Export/Preview/Lint/Diff) alignment + hit targets are tight; small tap area on mobile. (P1, Accessibility)
   - Target: `src/components/builder/PreviewTabs.tsx`
   - Proposed fix: increase min-height and padding; ensure `aria-selected` + focus ring consistent.
   - Status (Dec 29, 2025): tab sizing guidance documented; implementation pending.

## Translate
1) Input/output columns feel aligned but global spacing is tight around the top row (upload + output controls). (P3, Spacing)
   - Target: `src/app/translate/page.tsx`
   - Proposed fix: add top padding and spacing between sections.

2) Target selection pills appear small; reduce visual weight to avoid crowding. (P3, Visual hierarchy)
   - Target: `src/components/translate/TargetSelector.tsx`
   - Proposed fix: update chip sizing to align with library chips.
   - Status (Dec 29, 2025): pills/tags recipes documented; implementation pending.

## Atlas / Docs
1) Atlas landing grid (cards) uses minimal padding; card headers appear cramped. (P3, Spacing)
   - Target: `src/app/atlas/page.tsx`
   - Proposed fix: increase card padding or use new surface tokens.

2) Docs landing card list has inconsistent spacing and short descriptions. (P3, Visual hierarchy)
   - Target: `src/app/docs/page.tsx`
   - Proposed fix: align card padding/spacing with atlas cards; improve typographic scale.

## Auth
1) Sign-in page header layout has overlapping banner/header elements and “Back home” is floating mid-strip. (P1, Alignment)
   - Target: `src/app/signin/page.tsx`, `src/components/SiteNav.tsx`, auth layout component
   - Proposed fix: unify sign-in layout header; ensure wordmark banner doesn’t overlap local header; position “Back home” with consistent spacing.

2) Sign-in card copy is vertically centered but right panel has too much whitespace. (P3, Spacing)
   - Target: `src/app/signin/page.tsx`, `src/components/auth/SignInCard.tsx`
   - Proposed fix: reduce vertical padding or introduce accent panel detail matching header palette.

## Mobile / Tablet Notes
1) Mobile header + bottom nav alignment: banner height eats too much vertical space and bottom nav overlaps hero section. (P2, Spacing)
   - Target: `src/components/SiteNav.tsx`, `src/components/BottomNav.tsx`
   - Proposed fix: shrink banner height on mobile, adjust `top` offsets, and add spacing between hero and bottom nav.

2) Tabs across mobile (workbench export/preview/etc) are hard to tap. (P1, Accessibility)
   - Target: `src/components/builder/PreviewTabs.tsx`
   - Proposed fix: min 44px height, clear focus rings, stronger active indicator.

## Tab Picker Specific Issues
- Tab styles differ between header nav underline, workbench tabs, and any Radix tabs usage. (P2)
  - Target: `src/components/ui/Tabs.tsx`, `src/components/builder/PreviewTabs.tsx`, `src/components/SiteNav.tsx`
  - Proposed fix: centralize active indicator styles + consistent padding/token usage.
  - Status (Dec 29, 2025): tab recipes documented; align usage in implementation pass.

## Light/Dark Theme Mismatches
- Wordmark banner is dark even in light theme; visually heavy over white UI. (P2)
  - Target: `src/components/wordmark/LivingCityWordmarkSvg.tsx`, palette tokens in `src/app/globals.css`
  - Proposed fix: consider lighter sky palette or gradient in light theme to reduce contrast jump.

- Footer background is neutral light; consider tying to wordmark palette. (P3)
  - Target: `src/components/Footer.tsx`, `src/app/globals.css`

## Notes / Follow-ups
- Evaluate adding a dedicated header layout for auth pages to avoid overlapping strips.
- Consider a subtle motion for header (twinkle) and a matching micro-motion on cards for cohesive feel.
