# Monorepo merge smoke test (2026-01-04)

## Summary
- CLI scan output matches scan-spec-v1 schema and expected ordering.
- Web app boots from `apps/web` without runtime errors.
- Smoke test results recorded here with screenshot evidence.

## Environment
- Local dev environment (`/Users/honk/code/markdowntown-cli`).
- Date: 2026-01-04.

## Methodology
- CLI scan run twice for determinism; output captured to `/tmp` for inspection.
- Web dev server started from `apps/web` and checked for a clean 200 response.
- DevTools MCP was unavailable; used a Playwright headless Chromium script to capture console warnings/errors and confirm network idle status.
- Unit tests run for web and CLI as a sanity check.

## Pass/Fail summary
| Check | Status | Notes |
| --- | --- | --- |
| CLI scan schema/order | PASS | Schema version + key ordering validated. |
| CLI determinism | PASS | `configs[].path` ordering identical across rerun. |
| Web dev server boot | PASS | `GET /` returned 200; no runtime errors. |
| Playwright console/network check | PASS | No console errors/warnings; status 200. |
| Playwright interaction smoke | PASS | Landing page CTA tests (desktop + mobile). |
| Web unit tests | PASS | `pnpm --filter ./apps/web test:unit`. |
| CLI tests | PASS | `cd cli && make test`. |

## CLI scan verification
- Command:
  - `MARKDOWNTOWN_REGISTRY=/Users/honk/code/markdowntown-cli/cli/data/ai-config-patterns.json ./cli/bin/markdowntown scan --repo . --repo-only --quiet > /tmp/monorepo-scan.json`
- Results:
  - `schemaVersion`: `1.0.0`
  - `registryVersion`: `1.0`
  - `toolVersion`: `0.1.0`
  - `configs`: 8 entries
  - `warnings`: `null`
- Ordering:
  - Top-level keys appear in expected schema order: `schemaVersion`, `registryVersion`, `toolVersion`, `scanStartedAt`, `generatedAt`, `timing`, `repoRoot`, `scans`, `configs`, `warnings`.
  - Determinism check: re-ran scan to `/tmp/monorepo-scan-2.json` and confirmed identical `configs[].path` ordering.

## Web app boot + UI smoke
- Dev server:
  - `pnpm --filter ./apps/web dev`
  - Next.js started and served `GET / 200` without runtime errors in terminal output.
- Missing env vars:
  - Unit tests log `GitHub OAuth is not configured...` for auth callbacks, confirming graceful handling of missing OAuth env.
- DevTools:
  - Chrome DevTools MCP was unavailable (`Transport closed` on connect). Used Playwright fallback for console/network checks.
  - Playwright console check: no console errors/warnings; page response status 200.

## Playwright interaction smoke (2026-01-05)
- Test: `__tests__/e2e/landing-primary-flow.test.ts`
- Command:
  ```bash
  cd apps/web
  E2E_BASE_URL=http://localhost:3000 E2E_SCREENSHOT_PATH=docs/screenshots/monorepo-smoke/cta-click.png \
    pnpm test:e2e __tests__/e2e/landing-primary-flow.test.ts
  ```
- Results:
  - ✓ Desktop: CTA hierarchy + nav destinations (10518ms)
  - ✓ Mobile: core CTA still visible (1101ms)
  - All tests passed, no console errors/warnings
  - Screenshot captured at `docs/screenshots/monorepo-smoke/cta-click.png`
- Validated:
  - Primary CTA hierarchy on landing page (Scan > Workbench ordering)
  - Navigation links visible (Scan, Workbench, Library, Translate, Docs)
  - Responsive mobile layout with core CTAs visible
  - Asset loading successful (no network failures)

## Evidence
- Screenshot: `docs/screenshots/monorepo-smoke/web-home.png`
- Screenshot: `docs/screenshots/monorepo-smoke/cta-click.png` (Playwright landing page capture)
- Playwright console check:
  - `cd apps/web && node -e "const { chromium } = require('playwright'); ..."` (no console/page errors, status 200)
- CLI scan output saved to `/tmp/monorepo-scan.json` and `/tmp/monorepo-scan-2.json`.

## Tests run
- `pnpm --filter ./apps/web test:unit`
- `cd cli && make test`
- `E2E_BASE_URL=http://localhost:3000 pnpm test:e2e __tests__/e2e/landing-primary-flow.test.ts` (2 tests passed)
