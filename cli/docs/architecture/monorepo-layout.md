# Monorepo Layout

## Goal

Provide a single repository layout that keeps the Go CLI/LSP and the Next.js web app independent but cohesive, with shared contracts and tooling.

## Proposed Layout

```text
/
  apps/
    web/                 # Next.js app (UI, API routes, Prisma)
  cli/                   # Go CLI + LSP, Go tests, VS Code extension
  packages/
    engine-js/           # Node/WASM loader for Go engine
    schemas/             # Generated JSON Schema + TS types
  infra/                 # Azure Bicep, env params
  docs/                  # Shared docs, ADRs, runbooks
  scripts/               # Cross-repo dev + QA scripts
  pnpm-workspace.yaml    # JS workspace roots
  go.work                # Go workspace
```

## Responsibilities

- **apps/web**
  - Next.js UI + API routes
  - Prisma schema + migrations
  - Session auth (GitHub OAuth) and CLI token management
  - PubSub clients and living header

- **cli**
  - Go CLI and LSP implementation
  - Scan/audit/suggest rules (SSOT)
  - WASM and worker build targets
  - VS Code extension tests

- **packages**
  - JS/TS utilities used by web (engine loader, schemas)
  - Shared types generated from contracts

- **docs**
  - Architecture, ADRs, runbooks, testing guidance
  - CLI specs (scan/audit/suggest) remain canonical

- **infra**
  - Azure Bicep modules (ACA, Jobs, PubSub, Storage, Postgres)
  - Dev environment docker-compose (Postgres + Azurite)

## Hard Constraints

- No backward compatibility for legacy web data or UI flows.
- Go is the SSOT for rule logic and schemas; web must not re-implement rules.
- Azure-only cloud services; Cloudflare is DNS/TLS only.
- Postgres is the only supported database (dev/stage/prod).
- Single-owner projects in v1.
- CLI outputs and LSP diagnostics must remain stable (no regressions).

## Contract Strategy (Summary)

- **API contracts:** OpenAPI as canonical spec for web API; generate TS types from OpenAPI and keep Go clients in sync when needed.
- **Engine contracts:** JSON Schema for scan/audit/suggest payloads generated from Go structs; generate TS types from schemas.
- **Drift detection:** CI validates that generated types match schemas and that CLI output fixtures validate against schemas.

## Enforcement

- Add a CI job that checks layout invariants (apps/web, cli, packages) and fails if files are introduced in deprecated paths.
- Add CI checks that fail on stale generated types or schema drift.

## Migration Notes

- Migration is staged: copy/relocate code first, then remove old paths once CI is green.
- Any legacy layout must be treated as read-only until removed to avoid split-brain ownership.

## ADRs

- [ADR-0001: Monorepo layout](decisions/adr-0001-monorepo-layout.md)
- [ADR-0002: Constraints (no back-compat)](decisions/adr-0002-constraints-no-backcompat.md)
- [ADR-0003: Contracts + IDL strategy](decisions/adr-0003-contracts-idl.md)
- [ADR-0004: Go SSOT engine](decisions/adr-0004-go-ssot-engine.md)
- [ADR-0005: Azure-only infrastructure](decisions/adr-0005-azure-only.md)
