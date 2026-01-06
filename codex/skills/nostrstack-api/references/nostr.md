# Nostr endpoints (summary)

## Docs to consult in repo
- `docs/nostr-event-landing.md` (IDs, API contract, caching, relay behavior)
- `docs/nostr-event-references.md` (reference resolution rules)
- `docs/architecture/identity-resolution.md` (NIP-05 lookup)

## Key expectations
- Accept hex and bech32 identifiers, optional `nostr:` prefix.
- Enforce relay caps/timeouts and cache TTLs from config.
- Preserve safe rendering and link resolution for references.
