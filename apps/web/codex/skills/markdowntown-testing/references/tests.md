# Test commands + configs

## NPM scripts (package.json)
- `npm run compile` (TypeScript)
- `npm run lint` (ESLint + hex + neutrals)
- `npm run test:unit` (Vitest unit/integration)
- `npm run test:e2e` (Vitest E2E config)
- `npm run test:visual` (Playwright visual)

## Config files
- `vitest.config.ts`
- `vitest.e2e.config.ts`
- `vitest.setup.ts`
- `playwright-visual.config.ts`

## Test locations
- `__tests__/` (primary unit/integration suite)
- `docs/testing/*.md` (E2E flow narratives and checklists)

## Related tooling
- `scripts/check-no-raw-hex.mjs` and `scripts/check-no-tailwind-neutrals.mjs` (lint helpers)
- `scripts/lint-markdown.js` (markdown lint)
