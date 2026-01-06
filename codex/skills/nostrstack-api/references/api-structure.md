# apps/api layout (summary)

## Key paths
- `apps/api/src/server.ts` - Fastify setup
- `apps/api/src/setup-routes.ts` - route registration
- `apps/api/src/routes/` - HTTP routes
- `apps/api/src/services/` - business logic
- `apps/api/src/providers/` - Lightning providers (LNbits)
- `apps/api/src/nostr/` - Nostr utilities and handlers
- `apps/api/src/tenant-resolver.ts` - multi-tenant resolution
- `apps/api/prisma/` - Prisma schema and migrations
- `apps/api/tests/` - API tests

## Notes
- Keep route schema + validation consistent with existing patterns.
- Favor services for shared logic.
- Update `apps/api/openapi.json` if public API changes.
