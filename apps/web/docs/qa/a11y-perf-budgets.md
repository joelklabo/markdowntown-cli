# Accessibility & Performance Budgets (Dec 2025)

## Targets (per page)
- **Home / Browse / Snippet / Template / Builder**
  - LCP: ≤ 2.4s (desktop), ≤ 3.0s (mobile emu)
  - TTFB: ≤ 300ms (edge cached), ≤ 600ms (cold)
  - CLS: ≤ 0.05
  - JS transfer: ≤ 900KB (gzipped) main+chunks; CSS ≤ 200KB
  - Interaction Ready (INP proxy): ≤ 200ms for primary actions

## Accessibility checklist
- Color contrast AA across light/dark (use tokens only; check #RRGGBB banned).
- Focus order follows visual order; all interactive elements reachable.
- `aria-label`/`aria-expanded` on nav, search, toggles, drawers, command palette.
- Skip link visible on focus.
- Reduced motion: respect `prefers-reduced-motion`; avoid translate/opacity animations when enabled.
- Forms: label+input association, error text with `role="alert"`.
- Keyboard: all menus/palette/search sheets open/close with ESC and trap focus when modal.

## Instrumentation & checks
- Lighthouse CI budgets (existing `lighthouse-budget.json`) apply to `/`, `/browse`, `/snippets/[slug]`, `/templates/[slug]`, `/builder`. Run locally: `pnpm exec lhci autorun`.
- Web Vitals: emit LCP/CLS/TTFB via `web-vitals` already wired; add thresholds to alerts (TTFB >600ms, LCP >3s).
- Playwright smoke: ensure nav/search/builder flows still pass; add visual baselines per breakpoint for `/` and `/browse`.
- Hex lint (`pnpm lint:hex`) enforces token usage; prevents contrast regressions from ad-hoc colors.

## Tactics to hit budgets
- Prefer SSR + edge cache for public pages; use incremental static for browse/detail where possible.
- Use skeletons/suspense for builder panels; avoid large client bundles on landing.
- Defer non-critical scripts (analytics already lazy); tree-shake icons/components in stories.
- Motion: micro/component/panel presets; distance-based; disable transforms when reduced motion is set.

## Acceptance (per task)
- Light + dark parity, a11y checklist satisfied, Lighthouse scores ≥90 on perf/seo/a11y/pwa for target routes; budgets pass; no hex lint failures.
