# UX Heuristic Audit + DevTools/Log Review

Date: 2025-12-26
Scope: Home, Atlas Simulator, Library/Browse, Workbench, Builder, Translate, Docs/Legal.

## Method
- Heuristic review (clarity, hierarchy, feedback, error recovery, consistency, accessibility).
- Chrome DevTools console review across core pages.
- Existing logs review: `server.log`, `start.log`.

## DevTools notes (local, 2025-12-26)
- Console warnings repeat on multiple pages (Home, Atlas Simulator, Library, Workbench, Translate, Docs):
  - Unused preload warnings for `markdown-town-icon.svg` and multiple preloaded fonts.
  - Issue: “A form field element should have an id or name attribute” (Atlas Simulator: count 2; Workbench: count 5; Translate: count 3+).
- No blocking runtime errors observed during these checks, but warnings create noise and hide real issues.

## Scan flow summary
- Entry: nav Scan, Home CTA, and docs quickstart should converge on `/atlas/simulator`.
- Current risk: Scan setup copy does not explicitly describe what success looks like or where to go next.
- Primary improvement: make the results panel lead with a Workbench CTA and explain missing patterns in plain language.
- Supporting doc: `docs/ui/scan-flow.md` captures the target flow and acceptance metrics.

## Log review (UI impact)
- `server.log`:
  - Repeated warnings about `import-in-the-middle` / `require-in-the-middle` being externalized (opentelemetry + sentry). This clutters logs and makes UI issues harder to spot.
  - Baseline browser mapping data is outdated (dev-only warning).
- `start.log`:
  - Sentry + Turbopack warning (SDK not fully loaded in dev) — instrumentation gaps make UI regressions harder to diagnose.
  - `/relays` returning 404 in dev (IA confusion if linked or referenced).

## Per-surface heuristic findings

### Global navigation + header
- High: Reported header collapse after load in Atlas Simulator (likely layout shift). Needs investigation; the header should be stable across pages.
- Medium: Primary CTA (“Use a template”) competes with search + nav; hierarchy unclear.
- Medium: Theme toggle + sign-in controls sit mid-header without clear grouping; feel cramped at smaller widths.
- Low: Active state for nav is subtle; increases cognitive load across pages.

### Home
- Medium: Hero copy and CTA grouping feel dense; primary action isn’t clearly distinguished from secondary exploration.
- Medium: Social proof + feature sections lack a clear visual rhythm (cards, spacing, and section headings are inconsistent).
- Low: Empty-state messaging lacks “what next” guidance for first-time users.

### Atlas Simulator (Scan)
- High: First-time user flow unclear — “Scan setup” does not explicitly explain the expected folder structure or success criteria.
- High: Users do not know what happens after scan completes; next step panel feels optional and easy to miss.
- Medium: Tool selection + cwd are presented as form inputs but lack inline examples and validation affordances.
- Medium: Multiple fields flagged without id/name attributes; a11y risk and DevTools noise.
- Medium: Results summary is not prioritized; missing patterns should be clearly listed above optional insights.

### Library/Browse
- Medium: Search/filters are visually light; results and filters don’t read as a single system.
- Medium: Empty state lacks specific guidance (e.g., “Try uploading a folder to see outputs here”).
- Low: Card metadata hierarchy is inconsistent (owner/updated/labels compete).

### Workbench
- High: Dense multi-pane layout lacks an onboarding frame; users can’t tell where to start.
- Medium: Output panel actions (copy/download) compete with content; need clearer grouping.
- Medium: Missing id/name fields flagged in console; a11y noise.

### Builder
- Medium: `/builder` appears to route to or mirror Workbench; this is an IA clarity issue (users expect a distinct surface).
- Medium: Builder primary action isn’t singled out; needs a stronger “start here” cue.

### Translate
- Medium: Source/target inputs look similar to Workbench; lacks a clear flow for “choose tool → paste → preview.”
- Medium: Missing id/name fields flagged in console.

### Docs / Legal
- Low: Docs landing feels like a content dump; need a clearer entry path (Get Started vs Reference).
- Low: Legal pages are readable but lack consistent typography rhythm with app surfaces.

## Top 10 quick wins
1. Fix header collapse (investigate layout shift + hydration issues; lock header height).
2. Resolve missing form field id/name across simulator, workbench, translate.
3. Clean unused preloads (logo/fonts) or delay them until needed.
4. Add explicit “What happens next” stepper to Atlas Simulator scan flow.
5. Improve scan success state with a CTA to go to Workbench/Report.
6. Strengthen nav active states + CTA hierarchy in header.
7. Unify card spacing + typography rhythm across Home + Library.
8. Add empty-state guidance copy in Library and Workbench.
9. Clarify Builder vs Workbench IA (rename route or differentiate surfaces).
10. Tighten form helper text + validation hints to reduce ambiguity.

## Follow-up task candidates
- Header collapse investigation + fix (layout shift / hydration).
- Atlas Simulator onboarding + scan result guidance.
- Builder vs Workbench IA clarification.
- Docs landing IA and “Get Started” entrypoint.
