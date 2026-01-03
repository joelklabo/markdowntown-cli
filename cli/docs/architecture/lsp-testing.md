# Markdowntown LSP testing strategy

## Overview

LSP reliability is critical. A crash or hang breaks the editing flow. This strategy documents the current test layers and the expected additions (goleak + E2E) as LSP features expand.

## 1. Layered testing approach

### Level 1: Core logic unit tests (fast & isolated)

- **Focus:** `internal/scan`, `internal/audit`, and LSP helper functions (range conversion, settings parsing).
- **Mechanism:** `go test` with in-memory FS where possible.
- **Key scenarios:**
  - Frontmatter parsing with `yaml.v3` nodes (line/column correctness).
  - UTF-8 → UTF-16 offset conversion for diagnostics and code actions.
  - Audit rules: correct issue messages, evidence, and ranges.
  - Rule filtering + severity overrides.

### Level 2: LSP handler integration tests (in-process)

- **Focus:** `internal/lsp` handlers and state management.
- **Mechanism:** in-process `glsp` server with `net.Pipe()` and `jsonrpc2` client (see `internal/lsp/integration_test.go`).
- **Goleak expectation:** add `go.uber.org/goleak` verification for LSP tests to catch goroutine leaks on shutdown and cancel.
- **Key scenarios:**
  - Initialize → diagnostics → shutdown lifecycle.
  - Registry env (`MARKDOWNTOWN_REGISTRY`) set for hover/definition/completion.
  - Diagnostics include tags/codeDescription/related info when supported.
  - Overlay-only buffers (opened but not on disk) are included in scans.

### Debounce + cancellation guidance

- Set `Server.Debounce` to a small value in tests to avoid sleeps.
- Use channels (`waitForDiagnostics`) rather than fixed `time.Sleep`.
- When sending rapid `didChange` events, assert only the final state publishes diagnostics.
- Verify timers are stopped/cleared on shutdown to avoid leaks.
- If `$\/cancelRequest` is added, ensure handlers honor `context.Context` cancellation.

### Level 3: E2E (client/binary)

- **VS Code extension tests:** validate diagnostics + code actions in the extension harness (`vscode-extension/src/test`).
- **Binary sanity (optional):** spawn `markdowntown serve` via `os/exec` to ensure stdout is clean and the process exits on shutdown/SIGTERM.

## 2. Feature-specific suites

### Location fidelity

- Inputs with markers to validate frontmatter locations and diagnostic ranges.
- Include Unicode (emoji, multi-byte) to ensure UTF-16 mapping is correct.

### Hover + code actions

- Hover boundaries (first/last token char) and outside-token results (null).
- Code action idempotency and range validation (`WorkspaceEdit` matches diagnostics).

## 3. Tooling & infrastructure

- **CI:** `make lint`, `make test`, plus `go test -race ./internal/lsp` for concurrency coverage.
- **Stdout hygiene:** ensure LSP logging stays on stderr; avoid stdout in LSP handlers.
- Add a transport-layer test that fails if non-RPC bytes are written to stdout.
- **Fixtures:** use in-repo testdata for reproducible diagnostics cases.

## 4. Performance benchmarks

- Track latency from `didChange` → `publishDiagnostics` for large files.
- Establish a baseline for scan + audit throughput under load.

## Open questions + assumptions

- Decide if goleak should run for all LSP tests or only integration tests.
- Clarify the minimum E2E coverage required for VS Code (smoke vs full diagnostics matrix).
