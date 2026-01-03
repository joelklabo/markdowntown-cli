# Visual testing workflow

## When to switch to a production build
Use the dev server for fast iteration. Switch to a production build when visual snapshots are flaky on dev (runtime overlays, hydration errors, or inconsistent diffs between runs).

## Production build workflow
1. Build the app:
   - `pnpm build`
   - If a test requires auth or feature flags, pass the same env vars you use in dev (for example, NEXTAUTH or feature flag overrides).
2. Start the server:
   - `pnpm start --hostname 0.0.0.0 --port 3000`
3. Run Playwright:
   - Update snapshots: `pnpm exec playwright test --config=playwright-visual.config.ts --update-snapshots`
   - Verify baselines: `pnpm test:visual`
   - Alternate port: `BASE_URL=http://localhost:3001 pnpm test:visual`

## If snapshots are still unstable
- Re-run with fewer workers: `pnpm test:visual -- --workers=1`.
- Ensure deterministic data sources (consider `SKIP_DB=1` where supported).
- Run a DevTools smoke check: `node scripts/qa/devtools-smoke.mjs --url http://localhost:3000 --health 1 --health-timeout 5000 --retries 2`.
- If flakiness persists, document the symptom and open a follow-up issue.

## Related docs
- `docs/qa/visual-regression-plan.md`
- `docs/qa/header-wordmark-checklist.md`
