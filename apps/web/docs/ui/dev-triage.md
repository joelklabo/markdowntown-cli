# Dev Triage Notes

## Turbopack module factory error

### Symptoms (MCP)
- Dev server logs: "module factory is not available" for app route modules.
- Affected pages briefly return 500 after Fast Refresh.

### Likely trigger
- Next.js 16 Turbopack + frequent file changes in a large workspace.
- Occasionally accompanied by watchpack/too-many-open-files errors.

### Mitigation
- Default `pnpm dev` disables Turbopack via `NEXT_DISABLE_TURBOPACK=1`.
- Use `pnpm dev:turbo` only when validating Turbopack-specific behavior.
- If you must stay on Turbopack, restart the dev server after the error or raise file descriptor limits (macOS: `ulimit -n 2048`).

### Repro (when testing Turbopack)
1. Run `pnpm dev:turbo`.
2. Edit a client component (e.g., `src/components/atlas/AtlasSearch.tsx`) a few times to trigger Fast Refresh.
3. Reload `/atlas/simulator` or `/workbench` and observe the console error.

## DevTools MCP timeouts

### Symptoms (Watchpack)
- DevTools MCP commands time out when opening pages.
- QA automation cannot capture console/network logs.

### Checks
1. Confirm the dev server responds: `curl -I http://localhost:3000`.
2. Load `http://localhost:3000/` in a local browser to verify it renders.
3. Run `pnpm mcp:health` (retry example: `MCP_HEALTH_RETRIES=3 MCP_HEALTH_TIMEOUT=3000 pnpm mcp:health`).
4. Close any stale DevTools MCP pages and open a fresh page.
5. If timeouts persist, restart the MCP bridge/agent and retry the page load.
6. Capture the exact MCP error text and dev server status in QA notes.

### Repro (Codex MCP)
1. Start dev server: `WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm dev`.
2. Attempt a new page via MCP (e.g., `chrome-devtools/new_page` to `http://localhost:3000/`).
3. Observe tool timeout: `timed out awaiting tools/call after 60s` (no page opened).
4. Run `pnpm mcp:health` and include output in the repro notes.

### Notes (MCP timeouts)
- Timeouts may occur even when the dev server is healthy; capture the MCP error text in QA notes.

### Capture on failure
- MCP error text (full timeout message).
- Dev server status output (`curl -I http://localhost:3000`).
- MCP health output (include retries/timeouts used).
- Whether `WATCHPACK_POLLING`/`WATCHPACK_POLLING_INTERVAL` were set.

### Fallback evidence (if MCP remains unavailable)
- Run the smoke helper: `node scripts/qa/devtools-smoke.mjs --url http://localhost:3000/translate`.
- Capture a screenshot: `pnpm exec playwright screenshot http://localhost:3000/translate docs/screenshots/translate-download/translate-download.png`.
- Attach `/tmp/markdowntown-dev.log` to the QA notes.

## Watchpack EMFILE / route 404s in dev

### Symptoms
- `EMFILE: too many open files` warnings in dev logs.
- `/` or `/atlas/simulator` returns 404 after hot reloads.
- HMR WebSocket disconnects during E2E runs.

### Mitigation (Watchpack)
- Restart dev with polling: `WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm dev`.
- Keep `/tmp/markdowntown-dev.log` open and confirm no `EMFILE` warnings.
- If routes still 404, ensure Webpack is forced: `pnpm dev` or `pnpm dev:webpack` (runs `next dev --webpack`).

### Repro (Watchpack)
1. Run `pnpm dev` without polling in a large repo.
2. Trigger multiple file changes and reload `/atlas/simulator`.
3. Observe 404s or `EMFILE` in logs.

### Capture on failure (Watchpack)
- `/tmp/markdowntown-dev.log` excerpt showing `EMFILE` or 404s.
- Dev command used (include WATCHPACK variables).

## Scan flow feature flags

### Notes (Scan flags)
- `NEXT_PUBLIC_SCAN_NEXT_STEPS_V1=1` enables the Next steps panel; unset/0 hides it.
- `NEXT_PUBLIC_SCAN_QUICK_UPLOAD_V1=1` shows the quick upload fallback when directory picker is unavailable.

## Unit test timeouts

### Symptoms (Unit tests)
- `pnpm test:unit` exceeds default timeouts in CI or automation.

### Mitigation (Unit tests)
- Rerun with a higher timeout: `pnpm test:unit -- --testTimeout=30000`.

### Capture on failure (Unit tests)
- Command used and any timeout stack traces.
