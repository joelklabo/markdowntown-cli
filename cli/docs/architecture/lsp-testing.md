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
- **Goleak coverage:** `go.uber.org/goleak` verifies no goroutine leaks on shutdown or debounce cancellation.
- **Key scenarios:**
  - Initialize → diagnostics → shutdown lifecycle.
  - Registry env (`MARKDOWNTOWN_REGISTRY`) set for hover/definition/completion.
  - Diagnostics include tags/codeDescription/related info when supported.
  - Overlay-only buffers (opened but not on disk) are included in scans.

### Goroutine leak detection (goleak)

**Why it matters:**

LSP servers are long-lived processes that handle many requests over their lifetime. Leaked goroutines can accumulate and cause:
- Memory leaks from goroutine stacks and captured variables
- Resource exhaustion from file descriptors or network connections
- Unpredictable behavior from background work continuing after shutdown

**How it works:**

Goleak runs after each test via `TestMain` and verifies that all goroutines started during the test are properly terminated. Tests also use `defer goleak.VerifyNone(t)` for explicit verification in specific scenarios (e.g., shutdown, debounce cancellation).

**Configuration:**

The `goleakOptions()` function in `internal/lsp/leak_test.go` defines which goroutines to ignore:
- `IgnoreCurrent()`: stdlib and test runner goroutines that exist before the test starts
- Library-specific ignores: long-lived goroutines from dependencies (e.g., glsp's BufferedWriter)

See `internal/lsp/leak_test.go` for detailed rationale comments on each ignore entry.

**Running leak checks:**

```bash
# Run all LSP tests with leak detection (default)
go test ./internal/lsp

# Run with race detector for concurrency bugs
go test -race ./internal/lsp

# Run only leak-related tests
go test ./internal/lsp -run Leak
```

**Interpreting failures:**

If goleak detects a leak, you'll see output like:

```
goleak: Errors on successful test run: found unexpected goroutines:
[Goroutine 42 in state chan receive, with markdowntown-cli/internal/lsp.(*Server).runDiagnostics on top of the stack:
...stack trace...]
```

This indicates:
- **Goroutine ID**: 42
- **State**: chan receive (blocked reading from a channel)
- **Location**: Server.runDiagnostics function

To fix:
1. Identify where the goroutine was started (look for `go func()` near the top function in the stack)
2. Ensure the goroutine has a termination condition (context cancellation, channel close, timer stop)
3. Verify cleanup happens in all code paths (defer, t.Cleanup, server shutdown)

**Negative test:**

A negative test demonstrates that goleak correctly catches leaks:

```bash
# This test should FAIL with a goleak error
MARKDOWNTOWN_TEST_LEAK_NEGATIVE=1 go test ./internal/lsp -run LeakDetectionNegative -v
```

If the negative test passes, goleak is not configured correctly.

### Debounce + cancellation coverage

- `Server.Debounce` is configurable in tests to avoid long sleeps.
- Rapid `didChange` events are tested under `-race` to ensure only the final state publishes diagnostics.
- Pending timers are explicitly cancelled on `didClose` and shutdown.

### Level 3: E2E (client/binary)

- **VS Code extension tests:** validate diagnostics + code actions in the extension harness (`vscode-extension/src/test`).
- **Binary sanity:** `TestServeCanary` spawns the binary via `os/exec` to ensure stdout is clean and JSON-RPC framing is robust.

## 2. Feature-specific suites

### Location fidelity

- Inputs with markers to validate frontmatter locations and diagnostic ranges.
- Include Unicode (emoji, multi-byte) to ensure UTF-16 mapping is correct.

### Hover + code actions

- Hover boundaries (first/last token char) and outside-token results (null).
- Code action idempotency and range validation (`WorkspaceEdit` matches diagnostics).

### Document symbols

- Assert tree structure and ranges for frontmatter keys.
- Verify behavior for files with and without frontmatter.

## 3. Tooling & infrastructure

- **CI:** `make lint`, `make test`, plus `go test -race ./internal/lsp` for concurrency coverage.
- **Stdout hygiene:** ensure LSP logging stays on stderr; avoid stdout in LSP handlers.
- Add a transport-layer test that fails if non-RPC bytes are written to stdout.
- **Fixtures:** use in-repo testdata for reproducible diagnostics cases.

## 4. Performance benchmarks

- Track latency from `didChange` → `publishDiagnostics` for large files.
- Establish a baseline for scan + audit throughput under load.

## 5. Deprecation Warnings

### Node.js punycode

During `make lsp-vscode-test`, Node.js may emit a `punycode` deprecation warning. This is a transitive dependency from `markdown-it` (used by `@vscode/vsce`). Since this is an external dependency used only for packaging/testing and not part of the runtime server, it is currently ignored.

## Open questions + assumptions

- Decide if goleak should run for all LSP tests or only integration tests.
- Clarify the minimum E2E coverage required for VS Code (smoke vs full diagnostics matrix).
