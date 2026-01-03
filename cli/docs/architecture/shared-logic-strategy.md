# Shared Logic Strategy (CLI + Web)

## Goal

Provide a single source of truth (SSOT) for scan/audit/suggest rules across the Go CLI/LSP and the web app, without rewriting core logic or creating drift.

## Context

- The CLI/LSP is implemented in Go (`internal/scan`, `internal/audit`, `internal/suggest`).
- **Scope:** The web app focuses on *auditing* and *suggesting* on provided content. *Scanning* (filesystem crawling) is out of scope for the web/WASM component.
- The web app is TypeScript/Next.js and needs to evaluate audit rules against uploaded snapshots.
- Re-implementing rules in TS creates drift and doubles validation burden.
- Running a Go binary per request is slow and operationally heavy.

## Decision

**Primary path:** compile the Go audit/suggest engines to WebAssembly (WASM) and load them in the web app (server-side or client-side as appropriate).

- **Tooling:** Use the standard Go compiler for Node.js environments (where size is less critical) and evaluate **TinyGo** for browser-side usage if binary size exceeds 2MB.
- **Interface:** Expose a single `evaluate(snapshotJSON: string): string` function to avoid complex JS/Go object mapping.

**Fallback path:** run the Go CLI as a sidecar service (or serverless job) behind internal APIs if WASM constraints block the approach.

**Not chosen:** full TypeScript re-implementation except as a last-resort subset for UI-only previews.

## Options Considered

### Option A: Go → WASM (chosen)

#### Pros (Go → WASM)

- Single rules implementation (SSOT in Go).
- Deterministic parity between CLI and web.
- Can run in Node or browser (with constraints).
- Easier to test parity via shared fixtures.

#### Cons (Go → WASM)

- WASM binary size and startup cost.
- Limited filesystem access in browser context.
- Tooling complexity (build/loader, bundlers).

### Option B: Sidecar Go service

#### Pros (Sidecar)

- Full Go runtime, no WASM limits.
- Can reuse CLI code with minimal changes.
- Simpler audit execution for large inputs.

#### Cons (Sidecar)

- Extra deployment and runtime cost.
- Network hop for every evaluation.
- Operational complexity (scaling, monitoring).

### Option C: Re-implement in TypeScript

#### Pros (TypeScript)

- Native to web stack, no WASM/tooling burden.
- Easy to integrate with UI state.

#### Cons (TypeScript)

- High risk of drift from Go CLI.
- Doubles maintenance and test burden.
- Increases long-term cost and bugs.

## SSOT Ownership

- **Rule source:** `cli/internal/audit` and `cli/internal/suggest` are the SSOT for rule definitions, IDs, and copy.
- **Schema source:** scan/audit schema docs under `docs/` remain canonical; TS types are generated from Go JSON struct definitions (e.g. using `tygo` or via JSON Schema) to ensure strict alignment.
- **WASM build artifact:** generated from the same commit as the Go rules and versioned alongside the web app.

## Update Workflow

1. Update rules in Go (`cli/internal/audit`, `cli/internal/suggest`).
2. Update docs (`docs/architecture/diagnostic-catalog.md`, rule copy if needed).
3. Regenerate TypeScript types if Go structs changed.
4. Rebuild WASM artifact (see Build/Run below).
5. Update web loader and fixtures as needed.
6. Run parity tests against shared fixtures.

## Build / Run Steps (WASM)

**Build (example):**

```bash
cd cli
# Standard Go build (robust compatibility):
GOOS=js GOARCH=wasm go build -o dist/markdowntown.wasm ./internal/wasm
# Optimization candidate: TinyGo (smaller size, strict subset):
# tinygo build -o dist/markdowntown.wasm -target=wasm ./internal/wasm
```

**Web loader (Node/server):**

- Load WASM in a server-only module for audit evaluation during snapshot ingest.
- Interface: The WASM module exposes a global function (e.g., `auditSnapshot(bytes)`) that accepts serialized snapshot bytes and returns serialized diagnostic results.
- Cache the compiled module to avoid repeated instantiation.
- Enforce input size limits and execution timeouts before invoking the WASM entrypoint.

**Browser usage (optional):**

- Only for lightweight checks; no filesystem access.
- Enforce size limits for inputs to avoid UI stalls.

## Interface Contract (JS ↔ WASM)

- **Input type:** prefer `Uint8Array` (bytes) over JSON strings to avoid encoding overhead.
- **Validation:** reject inputs over a documented size cap before invoking WASM.
- **Timeouts:** enforce a max execution time; return structured timeout errors.
- **Error schema:** return a JSON object with `code`, `message`, `details`, and `version` fields.
- **Panic handling:** Go entrypoint must `recover` and return a structured error instead of crashing.

## Version Compatibility

- Embed `toolVersion` and `schemaVersion` in WASM responses.
- Web rejects mismatched versions and surfaces a clear recovery path.
- CI must rebuild the WASM artifact on any Go rule or schema changes.

## Execution Model (Node)

- Decide between a **singleton module** (serialized calls) or a **worker pool** (parallelism).
- Document the default strategy and the concurrency limits.
- Measure p95 latency across payload sizes (10KB / 1MB / 10MB) before rollout.

## Observability

- Add a logging bridge so Go logs are surfaced through the JS logger.
- Record execution time, error counts, and version mismatches.
- Alert on repeated timeouts or panic recoveries.

## Fallback Plan (Sidecar)

If WASM is too large/slow or cannot be loaded reliably:

- Run the Go CLI as an internal service with a stable API:
  - `/internal/audit` receives snapshot payloads and returns issues.
- Use the same Go rules package; no TS re-implementation.
- Keep the service internal (not public) and rate-limited.

## Edge Cases and Mitigations

- **WASM Panics:** Wrap Go execution in a recovery handler; return structured error JSON to the JS host instead of crashing the module.
- **WASM size limits:** keep exports minimal; strip debug symbols.
- **Snapshot size limits:** reject inputs over the configured cap before invoking WASM.
- **Timeouts:** abort long-running evaluations and return structured errors.
- **Concurrency:** avoid shared mutable state across concurrent evaluations unless protected.
- **Browser vs Node differences:** prefer Node/server for large audits.
- **Version skew:** embed CLI version + schema version in WASM output; web rejects mismatched versions.
- **String size limits:** avoid large JSON strings; pass bytes instead.
- **I/O constraints:** scanning stays CLI-side; web receives pre-scanned snapshots.

## Testing Strategy

- Golden fixtures shared between CLI and web.
- Snapshot parity tests: same input, same issue IDs and copy.
- WASM smoke test in CI to ensure loader remains functional.

## Open Questions

- Which audit subsets (if any) should run client-side vs server-side?
- Maximum allowed snapshot size for WASM execution in Node?
- Should the WASM build be versioned as a separate artifact or bundled with the web app?
