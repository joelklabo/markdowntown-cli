# DevTools MCP QA

## Quick start
1. Start the app locally:
   - `npm run dev`
2. (Optional) Verify the dev server is reachable:
   - `npm run mcp:health`
3. Run the Playwright-based smoke check (fallback when MCP is flaky):
   - `node scripts/qa/devtools-smoke.mjs --url http://127.0.0.1:3000 --health 1 --retries 2`

## Health probe
The health probe issues a lightweight `HEAD` request before launching Playwright. Configure it with:
- `DEVTOOLS_SMOKE_HEALTH=1`
- `DEVTOOLS_SMOKE_HEALTH_TIMEOUT=2000`

## Retries
`devtools-smoke` will retry navigation if the page is still compiling or the dev server is warming up:
- `DEVTOOLS_SMOKE_RETRIES=2`
- `DEVTOOLS_SMOKE_RETRY_DELAY=500`

## Troubleshooting
- Transport closed errors (common causes):
  - MCP bridge/agent stopped or restarted.
  - Chrome closed or the DevTools target was refreshed mid-session.
  - Multiple DevTools sessions open against the same target.
  - Dev server still compiling and the page never reached a stable state.
- Recovery steps:
  1) Close any existing DevTools MCP pages/tabs.
  2) Restart the MCP bridge/agent, then rerun `npm run mcp:health`.
  3) Re-open a fresh DevTools page and retry the console/network capture.
  4) If it still fails, run the fallback smoke check: `node scripts/qa/devtools-smoke.mjs --url http://127.0.0.1:3000 --health 1 --retries 2`.
- MCP timeouts: restart the MCP bridge/agent and rerun `npm run mcp:health`.
- `Network.enable` timeouts: follow `docs/qa/devtools-troubleshooting.md` to reset MCP targets and restart the dev server if needed.
- Slow dev server startup: increase `DEVTOOLS_SMOKE_RETRIES` and `DEVTOOLS_SMOKE_TIMEOUT`.
- EMFILE watch errors: set `WATCHPACK_POLLING=true` and `WATCHPACK_POLLING_INTERVAL=1000` before `npm run dev`.
- If MCP is unavailable: rely on `node scripts/qa/devtools-smoke.mjs` and attach screenshots/logs to QA notes.

## Known warnings
- Review `docs/qa/known-warnings.md` for expected dev log warnings and when they are actionable.
