# NIP-05 identity resolution (summary)

## Flow
1) Trim input, strip leading `nostr:`.
2) Request: `GET /api/nostr/identity?nip05=name@domain`.
3) Fetch `https://domain/.well-known/nostr.json?name=<name>` and map to pubkey.

## Guardrails
- Enforce max response bytes and timeouts.
- Cache results where available.
