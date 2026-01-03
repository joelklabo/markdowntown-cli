# E2E test user setup

Use a signed-in Playwright storage state to run auth-required E2E tests (PublishArtifactFlow, AuthCreateArtifactFlow, AuthCreateDocumentFlow).

## Required env
- `E2E_TEST_USER` (any non-empty value enables auth E2E tests)
- `E2E_STORAGE_STATE` (path to a Playwright storage state JSON file)
- `E2E_BASE_URL` (optional, defaults to `http://localhost:3000`)

## Generate storage state (local)
1. Start the app: `npm run dev`
2. Launch Playwright codegen:
   - `pnpm dlx playwright codegen http://localhost:3000`
3. Sign in with GitHub.
4. Save storage state in the browser console:
   - `await context.storageState({ path: "storage-state.json" })`

## Run the PublishArtifactFlow test
```bash
E2E_TEST_USER=local E2E_STORAGE_STATE=storage-state.json E2E_BASE_URL=http://localhost:3000 vitest run --config vitest.e2e.config.ts PublishArtifactFlow
```

## Notes
- If `E2E_TEST_USER` or `E2E_STORAGE_STATE` is missing, auth E2E tests are skipped with a clear reason.
- For additional context, see `docs/testing/e2e-auth-notes.md`.
