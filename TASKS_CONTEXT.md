# Task Context & Implementation Guide

> **NOTE TO WORKER:** The `bd` task descriptions were simplified to avoid parsing errors. Use this document as the detailed specification for each task.

## Epic: Transform markdowntown-cli into an LSP Server (bd-7ed)

### Task 1: Foundation - Deps & Linter (bd-0sg)
**Goal:** Prepare the repo for LSP development without breaking existing CLI.
- [ ] **Dependencies:**
    - `go get github.com/tliron/glsp` (and `github.com/tliron/commonlog` if needed for logging).
    - Ensure `github.com/spf13/afero` and `gopkg.in/yaml.v3` are pinned.
- [ ] **Linter:**
    - Update `.golangci.yml` to enable `forbidigo`.
    - Rule: Forbid `fmt.Print*` and `os.Stdout` in `internal/**`.
    - Exception: `cmd/**` is allowed to print to stdout.
- [ ] **Refactor `scan`:**
    - Modify `internal/scan/scanner.go` (and related files) to accept `fs afero.Fs` in the `Options` struct.
    - Update `cmd/markdowntown/main.go` to pass `afero.NewOsFs()`.
    - Update tests to use `afero.NewMemMapFs()`.

### Task 2: Refactor Frontmatter Parser (bd-np1)
**Goal:** Capture line/column numbers for diagnostics.
- [ ] **Refactor `ParseFrontmatter`:**
    - Input: `[]byte` (or `io.Reader`).
    - Output: `*ParsedFrontmatter` (struct) instead of `map[string]any`.
    - Logic: Use `yaml.Unmarshal` into `yaml.Node`.
- [ ] **Struct `ParsedFrontmatter`:**
    - `Data map[string]any`: The flattened data for existing consumers.
    - `Locations map[string]Range`: A lookup map for keys (e.g., "toolId" -> {Line: 5, Col: 4}).
- [ ] **Traverse:**
    - Write a recursive helper to walk the `yaml.Node` tree and populate `Locations` and `Data`.
- [ ] **Tests:**
    - Assert that `Locations["toolId"]` matches the actual line in the test string.

### Task 3: Refactor Audit Engine (bd-9ba)
**Goal:** Propagate location data to audit results.
- [ ] **Update `Issue` struct:**
    - Add `Range Range` field (StartLine, StartCol, EndLine, EndCol).
- [ ] **Update Rules:**
    - Modify `audit.Rule` interface to accept `*ParsedFrontmatter` (via `ConfigEntry`).
    - Update rules (e.g., `MD003`) to use the location data from the parser when generating issues.
    - Default to `Range{0,0,0,0}` (file level) if specific key location is missing.

### Task 4: LSP Scaffold & Lifecycle (bd-10x)
**Goal:** Get a "Hello World" LSP server running.
- [ ] **New Command:**
    - Add `serve` subcommand to `cmd/markdowntown/main.go`.
    - Logic: `lsp.RunServer(version.ToolVersion)`.
- [ ] **LSP Package (`internal/lsp`):**
    - `server.go`: Implement `glsp` handler.
    - `initialize`: Return `ServerCapabilities` (textDocumentSync: Full/Incremental).
    - `shutdown`/`exit`: Handle gracefully.
- [ ] **Logging:**
    - **CRITICAL:** Configure `glsp` logger to write to **stderr**.
    - Redirect `os.Stdout` to `os.Stderr` (or a pipe) at the start of `serve` to catch accidental prints.

### Task 5: LSP Document Sync (bd-74w)
**Goal:** Maintain an in-memory view of open files.
- [ ] **Overlay Filesystem:**
    - Create `type Server struct { overlay afero.Fs }`.
    - Use `afero.NewMemMapFs()` layered over `afero.NewOsFs()` (or just use MemMapFs for the "open" files if using a simple map approach).
- [ ] **Handlers:**
    - `textDocument/didOpen`: Write content to overlay.
    - `textDocument/didChange`: Update overlay.
    - `textDocument/didClose`: Remove from overlay.

### Task 6: LSP Diagnostics (bd-6xz)
**Goal:** Show squigglies in the editor.
- [ ] **Diagnostic Loop:**
    - On `didOpen` and `didSave`:
        1. Read content from overlay.
        2. Parse frontmatter (Task 2).
        3. Run audit engine (Task 3).
        4. Convert `[]audit.Issue` to `[]protocol.Diagnostic`.
        5. Send `textDocument/publishDiagnostics`.
- [ ] **Debouncing:**
    - Implement simple debouncing (e.g., 500ms) for `didChange` events if running audits on every keystroke is too slow.

### Task 7: LSP Hover & Definition (bd-pl0)
**Goal:** Add "intelligence".
- [ ] **Hover:**
    - `textDocument/hover`:
        1. Find the token under the cursor (using `yaml.Node` locations).
        2. If it's a `toolId`, look up description in `Registry`.
        3. Return `MarkupContent`.
- [ ] **Definition:**
    - `textDocument/definition`:
        1. If token is a `toolId`, return location of that tool in `ai-config-patterns.json` (if we map it) or just a link.
        2. Better: Link to the `AGENTS.md` definition if found in the workspace.

### Task 8: VS Code Extension (bd-uio)
**Goal:** A client to launch the server.
- [ ] **Folder:** `vscode-extension/`
- [ ] **Files:**
    - `package.json`: `onLanguage:markdown`, `onLanguage:json`.
    - `src/extension.ts`: Spawn `markdowntown serve` using `vscode-languageclient`.
    - Configuration: `markdowntown.serverPath` (default: "markdowntown").

### Task 9: Integration Tests (bd-7qs)
**Goal:** Verify it works without a GUI.
- [ ] **Level 2 Tests (In-Process):**
    - Use `net.Pipe()` to connect a `glsp.Client` to the `Server`.
    - Send `didOpen` with bad content -> Expect `publishDiagnostics`.
- [ ] **Level 3 Tests (Canary):**
    - `os/exec` the binary.
    - Send `initialize`.
    - Ensure `stdout` is a valid JSON-RPC message (no garbage).
