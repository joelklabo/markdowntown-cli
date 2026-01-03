# ADR-0003: Contracts + IDL strategy

Status: Accepted
Date: 2026-01-03

## Context

The monorepo must keep Go and TypeScript aligned for API payloads and engine outputs. Manual sync creates drift and regressions.

## Decision

Adopt an explicit contract/IDL strategy with code generation and drift checks:

- **Web API contracts** use OpenAPI as canonical specification (openapi.json).
  - Generate TypeScript types for web clients from OpenAPI.
  - Generate Go client/server stubs where needed.
- **Engine payloads** (scan/audit/suggest/snapshots) use JSON Schema generated from Go structs.
  - Publish schemas in `packages/schemas`.
  - Generate TypeScript types from schemas and use them in the web app.
- **Drift detection** in CI:
  - Validate CLI output fixtures against JSON Schemas.
  - Fail CI if generated types are stale relative to schemas.

## Enforcement

- Add a `pnpm contracts:generate` (OpenAPI -> TS) and a `go generate ./...` (Go -> JSON Schema) step.
- CI must run `pnpm contracts:check` and `go generate` to fail on mismatches.

## Consequences

- Additional codegen steps are required in CI and local dev.
- Schemas and OpenAPI become the SSOT for payload shape and versioning.
- Parity tests can use shared fixtures across Go and TS.

## Links

- docs/architecture/monorepo-layout.md
- docs/architecture/shared-logic-strategy.md
