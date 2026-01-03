# E2E auth notes (local/dev)

- Use `E2E_TEST_USER` env to signal tests can run with auth. Provide a Playwright `storageState` file pointing to an already-signed-in session.
- Generate storage state manually:
  1. `pnpm dlx playwright codegen http://localhost:3000`
  2. Sign in with GitHub.
  3. Save storage: `context.storageState({ path: "storage-state.json" })`.
  4. Set `E2E_STORAGE_STATE=storage-state.json` before running `pnpm test`.
- Alternatively, add a test OAuth provider dedicated to CI.
- Skipped by default when `E2E_TEST_USER` is unset to avoid flaky GitHub auth during CI.
