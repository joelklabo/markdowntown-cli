# UI Release Checklist

Date: 2025-12-26
Scope: UI polish sprint release readiness.

## Preflight
- [ ] Pull latest main and run full test suite (compile, lint, test:unit).
- [ ] Clear local caches and rebuild (Next.js, Vite, browser cache).
- [ ] Verify seed data and dev fixtures render expected empty states.

## Device + mode coverage
- [ ] Desktop: >= 1280px
- [ ] Laptop: 1024px
- [ ] Tablet: 768px
- [ ] Mobile: 375px
- [ ] Light mode + dark mode
- [ ] Reduced motion enabled
- [ ] Keyboard-only navigation

## Core flow UI checks
- [ ] Home hero + CTA hierarchy reads clearly on desktop and mobile.
- [ ] Atlas Simulator: scan inputs + results layout stable across breakpoints.
- [ ] Workbench: panels, tabs, and output areas align with spacing scale.
- [ ] Library/Browse: filters, cards, and detail drawer consistent.
- [ ] Translate: input/output alignment and helper text consistent.
- [ ] Docs/Legal: typography scale and spacing consistent, no overflow.

## Accessibility
- [ ] Focus states visible on all interactive controls.
- [ ] Labels and helper text announced by screen reader.
- [ ] Target sizes meet 44x44px minimum.
- [ ] Contrast meets 4.5:1 for body text.
- [ ] Reduced motion disables ambient animations.

## DevTools checks
- [ ] Console clean on /atlas/simulator after load.
- [ ] No hydration warnings on initial load.
- [ ] Performance: no long tasks > 200ms during initial render.
- [ ] Lighthouse a11y score >= 90 on core pages.

## Log review
- [ ] Review dev server logs for runtime warnings or errors.
- [ ] Verify API logs show no unexpected 4xx/5xx spikes.
- [ ] Document any remaining warnings with follow-up tasks.

## Release sign-off
- [ ] Visual diffs approved for key pages.
- [ ] All QA matrix rows pass.
- [ ] No open P0/P1 issues.
