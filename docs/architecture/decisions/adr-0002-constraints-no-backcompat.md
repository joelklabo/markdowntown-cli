# ADR-0002: Constraints (no back-compat)

Status: Accepted
Date: 2026-01-03

## Context

The merge requires a simplified, forward-looking architecture. Legacy web data models and UI flows are explicitly out of scope. CLI outputs and LSP diagnostics must remain stable to preserve existing integrations.

## Decision

Adopt the following non-negotiable constraints:

- No backward compatibility with legacy web data models or UI flows.
- Go is the SSOT for scan/audit/suggest logic and schemas.
- Azure-only cloud services; Cloudflare is DNS/TLS only.
- Postgres-only for all environments.
- Single-owner projects in v1.
- CLI output schemas and LSP diagnostics must not regress.

## Consequences

- Schema and UI redesign can proceed without migration constraints.
- Legacy endpoints and UI routes can be removed or redirected.
- Tests must enforce CLI schema stability and parity between Go and web.

## Links

- docs/architecture/monorepo-layout.md
