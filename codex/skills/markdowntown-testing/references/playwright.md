# Playwright + E2E references

## Narratives + guidance
- `docs/testing/public-e2e-regression.md`
- `docs/testing/first-time-user-e2e.md`
- `docs/testing/e2e-auth-notes.md`

## Playwright entry
- `npm run test:visual` uses `playwright-visual.config.ts`.

## Vitest E2E entry
- `npm run test:e2e` uses `vitest.e2e.config.ts`.
- Set `E2E_BASE_URL` for staging or local overrides.

## Tips
- Keep E2E flows aligned with product UX docs (Workbench/Skills flows).
- Update narratives when UX steps change to avoid stale coverage.
