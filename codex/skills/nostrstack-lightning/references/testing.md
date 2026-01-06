# Lightning testing (summary)

- Staging smoke: `LNBITS_URL=... LNBITS_ADMIN_KEY=... ./scripts/lnbits-smoke.sh 100`
- Pay-to-act E2E with settlement: set `LNBITS_URL` + `LNBITS_ADMIN_KEY`, then `pnpm --filter api test:e2e:pay`
