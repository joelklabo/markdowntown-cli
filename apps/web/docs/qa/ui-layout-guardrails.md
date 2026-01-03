# UI Layout & Interaction Guardrails
Date: 2025-12-20
Owner: markdowntown-5k8

## Objectives
- Prevent header action wrapping and control overflow at all breakpoints.
- Keep library/browse cards readable (min widths, multi-column) and ensure controls remain usable.
- Detect regressions automatically via E2E layout checks.
- Cover critical button/tab interactions so they never go inert.
- Keep tab pickers consistent in height/spacing and ensure focus visibility in light/dark.

## Action Plan
1) **Header resiliency**
   - Constrain desktop search to 240–360px and allow flex-1 shrink.
   - Apply `whitespace-nowrap` to CTA/Sign-in and `flex-nowrap` to the right cluster.
   - Add Playwright assertion on header button heights (no wrapping) at 1280px.

2) **Library grid stability**
   - Use CSS grid with `repeat(auto-fit, minmax(260px, 1fr))` to enforce card min width.
   - Ensure cards stretch full height and keep tags/actions wrapped without collapsing.
   - Playwright check: first card width > 240px and at least two columns visible on desktop.

3) **Interaction coverage**
   - Keep nav, search, and CTA flows in smoke tests (NavInteractions, CTAInteractions).
   - Add layout guard test (`NavLayout`) to CI (skipped unless `E2E_BASE_URL` provided).
   - Add future mobile viewport run (375px) to ensure bottom nav/search modal focus order.

4) **Tabs + spacing guardrails**
   - Tabs/pickers: min height 40px, label does not wrap, active state visually distinct in light/dark.
   - Spacing: cards use `p-mdt-5` + `space-y-mdt-3`; page sections follow `py-mdt-10 md:py-mdt-12`.
   - Check focus rings remain visible on active tabs and segmented controls.

5) **Visual QA backlog (next steps)**
   - Integrate percy/playwright screenshots for `/browse`, `/` header, `/builder` at desktop + mobile.
   - Add contract tests for pill overflow (cap to 2 lines, ellipsis) and button labels.
   - Track broken buttons/tabs as individual issues; fix and add regression checks when discovered.

## Test Hooks
- `pnpm test` includes `__tests__/e2e/NavLayout.test.ts` (skips without `E2E_BASE_URL`).
- CI E2E job can set `E2E_BASE_URL` to staging to enable layout assertions.

## Open Items
- Add mobile viewport assertions and bottom nav hit-area checks.
- Add clipboard/download parity checks for cards (mirrors document flow parity).
- Add aria-label coverage for overflow sheet links.
