# Nostrstack Codex skills plan

## Skill list + triggers

1) nostrstack-dev-workflow
- Trigger: start local dev, run logs, MCP DevTools checks, QA fallback
- References: docs/dev-logs-and-ui-checks.md, docs/mcp-setup.md, docs/local-demo.md, docs/testing.md
- Guardrails: keep logs visible; MCP/QA checks for UI changes

2) nostrstack-api
- Trigger: edit Fastify routes, Prisma schema, providers, API tests
- References: docs/architecture.md, apps/api/src/*, apps/api/prisma/*, docs/nostr-event-landing.md
- Guardrails: preserve tenant resolution + LightningProvider flow; update OpenAPI if needed

3) nostrstack-nostr
- Trigger: Nostr ID parsing, event landing, NIP-05, relay fetch/caching
- References: docs/nostr-event-landing.md, docs/nostr-event-references.md, docs/architecture/identity-resolution.md
- Guardrails: accept nostr prefix + bech32 types; enforce relay caps/timeouts and cache TTL

4) nostrstack-embed-ui
- Trigger: embed widgets, design tokens, gallery UI
- References: docs/design-system.md, docs/nostr-event-ui.md, docs/zap-ui-spec.md, docs/qr.md
- Guardrails: use tokens and .nostrstack-* classes; verify UI with MCP/QA

5) nostrstack-lightning
- Trigger: LNbits integration, regtest flows, observability
- References: docs/staging-lightning.md, docs/prod-lightning.md, docs/lightning-observability.md
- Guardrails: never copy secrets; keep webhook/payment states consistent

## General guardrails
- Keep dev logs visible while reproducing/fixing.
- For UI changes, verify in MCP Chrome DevTools or run QA fallback.
- Treat Key Vault and env values as secrets.
- Look for refactors/bugs and open new issues when found.
