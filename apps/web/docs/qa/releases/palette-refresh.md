# Palette refresh release notes

Date: 2025-12-29
Owner: @honk

## Summary
Shipped the palette refresh across the landing experience and core UI primitives, with updated screenshots and E2E coverage for the home + library flows.

## Changes
- Updated nav, footer, and landing hero styling to the refreshed palette.
- Refined core UI primitives (buttons, cards, pills, badges, inputs).
- Captured new visual baselines for home hero/footer and components grid.
- Added palette usage guidance and updated user guide CTA references.

## QA evidence
- E2E (Vitest runner): `E2E_HERO_SCREENSHOT_PATH=docs/screenshots/palette-refresh/home-hero.png E2E_FOOTER_SCREENSHOT_PATH=docs/screenshots/palette-refresh/home-footer.png npm run test:e2e -- SiteResponsiveSmoke`
- E2E (Vitest runner): `E2E_COMPONENTS_SCREENSHOT_PATH=docs/screenshots/palette-refresh/components-grid.png npm run test:e2e -- SectionFlow`
- Screenshots:
  - `docs/screenshots/palette-refresh/home-hero.png`
  - `docs/screenshots/palette-refresh/home-footer.png`
  - `docs/screenshots/palette-refresh/components-grid.png`
- DevTools MCP: failed to attach (`Network.enable` timeout); follow-up issue markdowntown-7bdl.
- Logs: Next.js dev server output reviewed during E2E runs; no runtime errors after enabling `WATCHPACK_POLLING=true`.
- CI (local): `npm run compile`, `npm run lint`, `npm run test:unit`

## Notes
- Contrast audit findings tracked in `docs/qa/contrast-audit.md` with follow-up tasks for soft status contrast and focus ring visibility.
