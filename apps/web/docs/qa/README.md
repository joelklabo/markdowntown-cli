# QA docs index

## Core checklists
- `docs/qa/ui-layout-guardrails.md`
- `docs/qa/header-wordmark-checklist.md`
- `docs/qa/a11y-ui-review.md`
- `docs/qa/a11y-perf-budgets.md`
- `docs/qa/visual-regression-plan.md`

## Troubleshooting
- DevTools MCP: `docs/qa/devtools-mcp.md`
- DevTools MCP timeout checklist: `docs/qa/devtools-troubleshooting.md`
- Contrast audit: `docs/qa/contrast-audit.md`
- Security UI review: `docs/qa/security-ui-review.md`

## Running E2E Tests

The web app uses a Playwright-based E2E test suite. To run tests against a local dev server:

### Filtered runs
Use the `--filter` flag to run a specific test suite or subset:

```bash
pnpm -C apps/web test:e2e -- --filter cli-sync-dashboard
```

**Note**: When using filters, Vitest will list all discovered test files but will report them as **skipped** if they do not match the filter. This is expected behavior.

### Dev server management
The E2E suite requires a running server (default port 3000). To avoid port conflicts:

1. **Check for existing processes**: Ensure no other `next dev` instances are running on port 3000.
2. **E2E_BASE_URL**: If your server is running on a different port, set the environment variable:
   ```bash
   E2E_BASE_URL=http://localhost:3001 pnpm -C apps/web test:e2e
   ```
3. **Wait for readiness**: The suite waits for the server to be ready before starting. If the server is slow to boot, increase the `timeout` in `vitest.e2e.config.ts`.

## WASM Audit Runtime
The repo detail view uses a WASM-based audit engine. To ensure stability and security, the engine is executed in an isolated environment.

- **Isolation**: Each audit run occurs in a dedicated `worker_thread` to prevent global Go runtime collisions and contain potential panics.
- **Timeouts**: Execution is strictly time-bounded (default 15s) to prevent stalled workers from blocking server resources.
- **Fail-safe**: If the worker fails or times out, the UI surfaces a clear error state and falls back to static results where available.
