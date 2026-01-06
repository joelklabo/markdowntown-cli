# Nostr IDs + API contract (summary)

## Identifiers
- Accept 64-char hex and bech32 types: `note`, `nevent`, `naddr`, `npub`, `nprofile`.
- Input may include optional `nostr:` prefix and must be handled case-insensitively.

## Routes
- UI: `/nostr/:id`
- API: `GET /api/nostr/event/:id` (optionally `GET /nostr/event/:id`)

## Caching + fetch
- Use config for cache TTL, max entries, relay cap, and per-relay timeout.
- Merge relays from request + server config; fall back to default relays when empty.
