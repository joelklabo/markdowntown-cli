# Known dev log warnings

Use this list to distinguish expected dev noise from actionable errors. When in doubt, capture logs and open a follow-up issue.

## Usually benign (dev only)
- `import-in-the-middle` / `require-in-the-middle` externalization warnings
  - Source: instrumentation packages being externalized during dev bundling.
  - Safe when the page renders and tests pass.
- Sentry + Turbopack warnings
  - Source: Sentry instrumentation running in `next dev --turbo`.
  - Safe when Sentry is disabled in dev and no runtime errors appear.

## Actionable (investigate)
- Edge Runtime crypto errors in middleware
  - Example: errors referencing `crypto` or `middleware.ts` in Edge runtime logs.
  - Action: avoid Node-only APIs in Edge middleware or opt out of Edge runtime for that path.
- Turbopack panic or Next.js runtime overlays
  - Example: `next-panic-*`, `Runtime SyntaxError`, or `Invariant` overlays.
  - Action: restart the dev server; if it persists, capture logs and open an issue.

## How to verify impact
- Confirm the target page renders and interactions work.
- Run a DevTools smoke check: `node scripts/qa/devtools-smoke.mjs --url http://localhost:3000 --health 1 --health-timeout 5000 --retries 2`.
- Re-run the relevant test (visual or E2E) after clearing warnings.
