# ADR-0004: Go SSOT engine

Status: Accepted
Date: 2026-01-03

## Context

Scan/audit/suggest rules live in the Go CLI and must not drift. The web app needs preview and server-side execution without re-implementing rules in TypeScript.

## Decision

Go remains the single source of truth for rule logic and output schemas.

Execution paths:

- **Native worker** (Go) for production runs and heavy workloads.
- **WASM preview** for lightweight UI previews or validation.

TypeScript re-implementation is explicitly rejected.

## Lifecycle

- Engine artifacts are versioned with the same git SHA as the Go rules.
- CI builds and publishes the worker binary and WASM bundle on every release.
- Web validates engine version compatibility and refuses mismatched schemas.

## Consequences

- Web must load Go-produced artifacts (WASM) or call the native worker.
- Parity tests are required to ensure identical outputs.
- Any rule change requires Go updates + schema regeneration.

## Links

- docs/architecture/shared-logic-strategy.md
