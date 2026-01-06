# Architecture (summary)

## Components
- API (`apps/api`): Fastify + Prisma. Handles multi-tenant LightningProvider, Nostr endpoints, LNURLp/NIP-05, payments/webhooks.
- Gallery demo (`apps/gallery`): Vite/React, hits API.
- Embed packages: `@nostrstack/embed`, `@nostrstack/blog-kit`.

## Tip flow (happy path)
Browser widget -> API `/api/pay` (tenant lookup) -> `LightningProvider.createCharge` (LNbits) -> invoice -> payer pays -> LNbits webhook -> API updates Payment -> widgets poll/verify.

## Environments
- Local: SQLite dev DB + regtest LNbits.
- Staging: LNbits + Postgres.
- Prod: LNbits + LND (cutover pending).
