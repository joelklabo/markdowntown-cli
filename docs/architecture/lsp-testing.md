# Markdowntown LSP Testing Strategy

## Overview
Reliability is critical for an LSP server. A crash or hang breaks the user's entire editing flow. This strategy outlines a multi-layered approach to ensure the `markdowntown-cli` LSP is robust, correct, and performant.

## 1. Layered Testing Approach

### Level 1: Core Logic Unit Tests (Fast & Isolated)
*   **Focus:** `internal/scan`, `internal/audit`, `internal/engine`.
*   **Mechanism:** Standard Go unit tests (`go test`).
*   **Key Scenarios:**
    *   **Frontmatter Parsing:** Verify `yaml.Node` correctly captures line/column for various YAML structures (nested, lists, folded strings).
    *   **Frontmatter Ranges:** Expect 1-based `startLine/startCol/endLine/endCol` ranges on parsed frontmatter locations.
    *   **Offset Mapping (Critical):** Verify the translation between Go's UTF-8 byte offsets and LSP's UTF-16 character offsets. *Must* include test cases with emojis and multi-byte characters to prevent "squiggly drift".
    *   **Audit Rules:** Test each rule against specific `ConfigEntry` states (valid, invalid, missing fields) and assert the correct `Issue` output and location data.
    *   **Panic Safety:** Verify that audit rules gracefully handle unexpected inputs without panicking.

### Level 2: LSP Handler Integration Tests (In-Process)
*   **Focus:** `internal/lsp` handlers and state management.
*   **Mechanism:** Connect a `glsp.Server` to a test client using `net.Pipe()` within the same process. This allows full `-race` detection and step-through debugging.
*   **Tooling:** `github.com/uber-go/goleak` to detect goroutine leaks.
*   **Key Scenarios:**
    *   **Registry Env:** Ensure `MARKDOWNTOWN_REGISTRY` is set (use `setRegistryEnv` helper) so hover/definition can load tool metadata.
    *   **Lifecycle:** `initialize` -> `initialized` -> `shutdown` -> `exit`.
    *   **Debouncing & Cancellation:** Rapidly send `didChange` events. Assert that:
        1. Only the final state triggers a full audit.
        2. Intermediate contexts are cancelled.
        3. No goroutines are leaked.
    *   **Diagnostics:** Open a file with known errors. Assert `textDocument/publishDiagnostics` is received with correct ranges. For overlay-only buffers, ensure the server includes the opened file path in the scan input.
    *   **Out-of-Order Messages:** Simulate network lag by sending `didChange` (v2) before `didChange` (v1) finishes processing. Verify state consistency.

### Level 3: End-to-End (E2E) Binary Sanity Check
*   **Focus:** `cmd/markdowntown` (the `serve` command binary).
*   **Mechanism:** A "Fake Editor" test suite that spawns the actual binary via `os/exec`.
*   **Scope:** Limited to critical "Canary" tests.
*   **Key Scenarios:**
    *   **Stdout Pollution:** Overwrite `os.Stdout` with a pipe, import all packages, and assert the pipe remains empty during initialization.
    *   **Process Control:** Verify correct exit codes on `shutdown` and SIGTERM.
    *   **Malformed Input:** Send garbage JSON or incomplete headers to stdin and verify the process doesn't crash (or exits with a defined error code).

## 2. Feature-Specific Test Suites

### A. The "Location Fidelity" Suite
This suite specifically targets the `yaml.Node` parsing logic.
*   **Input:** Files with embedded markers (e.g., `toolId: ^codebase_investigator^`).
*   **Assertion:** The parser must return the exact line/col of the markers.
*   **Edge Cases:** Folded block scalars, comments, Unicode characters.

### B. Hover & Code Actions
*   **Hover Fidelity:**
    *   Test hovering on boundaries (first/last char of token).
    *   Test hovering *outside* a valid token (should return null/empty).
    *   Verify Markdown content escaping.
*   **Code Actions:**
    *   **Idempotency:** Applying a fix twice should not corrupt the file.
    *   **Range Validation:** Verify `WorkspaceEdit` ranges match the diagnostic exactly.
    *   **Preview:** Verify `edit` payload is correct without applying it.

## 3. Tooling & Infrastructure
*   **CI/CD:** Run all tests with `go test -race ./...`.
*   **Linter:** `golangci-lint` with `forbidigo` enabled to catch `fmt.Print` calls.
*   **Mocking:** Use `afero.MemMapFs` heavily in Level 1 & 2 tests to avoid disk I/O.
*   **Leak Detection:** Use `goleak.VerifyNone(t)` in all Level 2 tests.

## 4. Performance Benchmarks
*   **Latency:** Measure time from `didChange` to `publishDiagnostics`. Goal: < 100ms for typical files.
*   **Throughput:** Simulate typing (100ms intervals) on a large file (2k lines) and measure CPU/Memory profile.
*   **Memory:** Monitor heap usage during `didOpen` of 100+ files to ensure no leaks in the OverlayFS.
