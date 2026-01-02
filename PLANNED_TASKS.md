# Planned Tasks (Creation Blocked)

I successfully created the Epic (`markdowntown-cli-7ed`) and Task 1 (`markdowntown-cli-0sg`), but subsequent `bd` commands were rejected by the system.

Here is the intended task tree for the worker to implement manually or attempt to create:

## Epic: Transform markdowntown-cli into an LSP Server (Created: markdowntown-cli-7ed)

### Task 1: Foundation - Deps & Linter (Created: markdowntown-cli-0sg)
- Status: Open
- Description: Add `glsp`, `afero`, `yaml.v3`. Add `forbidigo`. Refactor `scan` for `afero.Fs`.

### Task 2: Refactor Frontmatter Parser
- Parent: markdowntown-cli-7ed
- Description: Upgrade parser to use `yaml.Node` for location tracking.
- Files:
    - internal/scan/frontmatter.go (modify)
    - internal/scan/types.go (modify)
    - internal/scan/frontmatter_test.go (modify)
- QA: `go test -v internal/scan`

### Task 3: Refactor Audit Engine
- Parent: markdowntown-cli-7ed
- Description: Update audit engine to return `Issue` structs with `Range` info (derived from `ParsedFrontmatter`). Use `afero.Fs`.
- Deps: Task 2
- Files:
    - internal/audit/engine.go (modify)
    - internal/audit/types.go (modify)
    - internal/audit/rules.go (modify)

### Task 4: LSP Scaffold & Lifecycle
- Parent: markdowntown-cli-7ed
- Description: Implement `markdowntown serve` command and basic LSP server struct (`initialize`, `shutdown`). Redirect stdout to stderr.
- Deps: Task 1
- Files:
    - cmd/markdowntown/main.go (modify: add serve)
    - internal/lsp/server.go (create)
    - internal/lsp/lifecycle.go (create)

### Task 5: LSP Document Sync
- Parent: markdowntown-cli-7ed
- Description: Implement `textDocument/didOpen`, `didChange`, `didClose`. Maintain `afero.OverlayFs`.
- Deps: Task 4
- Files:
    - internal/lsp/sync.go (create)
    - internal/lsp/server_test.go (create: Level 2 tests)

### Task 6: LSP Diagnostics
- Parent: markdowntown-cli-7ed
- Description: Wire audit engine to `didChange`/`didSave`. Publish diagnostics. Implement debouncing.
- Deps: Task 3, Task 5
- Files:
    - internal/lsp/diagnostics.go (create)

### Task 7: LSP Hover & Definition
- Parent: markdowntown-cli-7ed
- Description: Implement `textDocument/hover` and `definition`. Lookup in Registry.
- Deps: Task 6
- Files:
    - internal/lsp/hover.go (create)
    - internal/lsp/definition.go (create)

### Task 8: VS Code Extension
- Parent: markdowntown-cli-7ed
- Description: Create `vscode-extension` folder with `package.json` and `extension.ts` (Generic Client).
- Deps: Task 4
- Files:
    - vscode-extension/package.json (create)
    - vscode-extension/src/extension.ts (create)
    - vscode-extension/tsconfig.json (create)

### Task 9: Integration Tests
- Parent: markdowntown-cli-7ed
- Description: Implement Level 2 (In-process) and Level 3 (Canary) tests.
- Deps: Task 7, Task 8
- Files:
    - internal/lsp/server_test.go (expand)
    - cmd/markdowntown/serve_test.go (create)
