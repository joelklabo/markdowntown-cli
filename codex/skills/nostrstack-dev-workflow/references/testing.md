# Testing matrix (summary)

## API
- Unit + Playwright: `NODE_OPTIONS=--no-experimental-strip-types pnpm --filter api test`
- API E2E: `pnpm --filter api test:e2e`
- Pay-to-act E2E (SQLite): `NODE_OPTIONS=--no-experimental-strip-types DATABASE_URL=file:./test-e2e.db pnpm --filter api test:e2e:pay`

## Gallery / demo
- Regtest zap UI: `pnpm qa:regtest-demo` (requires regtest flags)

## Staging LNbits smoke
- `LNBITS_URL=... LNBITS_ADMIN_KEY=... ./scripts/lnbits-smoke.sh 100`
