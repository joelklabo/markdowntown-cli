# Local demo/regtest (summary)

## Base flow
- Start stack via `make dev` or `pnpm dev:logs`.
- API runs on `localhost:3001`, gallery on `localhost:4173`.

## Nostr comments with real relays
- Set `VITE_NOSTRSTACK_RELAYS` to a reachable relay (e.g., `wss://relay.damus.io`).
- Enable a NIP-07 signer for comment posting.

## Payments
- Regtest zaps: enable `ENABLE_REGTEST_PAY=true` in API and `VITE_ENABLE_REGTEST_PAY=true` in gallery.
- Use regtest payer to settle invoices if needed.
