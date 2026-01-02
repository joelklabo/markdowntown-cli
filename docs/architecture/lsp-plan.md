# Markdowntown LSP Implementation Plan

## Objective
Transform the `markdowntown-cli` into a Language Server Protocol (LSP) server that shares core logic with the CLI. This provides real-time feedback and intelligent editing features for AI configuration files.

## Architecture: Shared Core & Transport Adapters

### 1. Separation of Concerns
- **Core Logic (`internal/engine`, `internal/scan`, `internal/audit`)**: 
    - Pure logic that accepts `afero.Fs` and `Registry` inputs.
    - Returns structured `Issue` and `Result` types.
    - **Zero side effects**: No direct printing to `os.Stdout`.
- **CLI Adapter (`cmd/markdowntown`)**:
    - Uses `afero.NewOsFs()`.
    - Formats output for the terminal.
    - Manages `os.Stdout` for JSON/Markdown output.
- **LSP Adapter (`internal/lsp`)**:
    - Uses a composite `afero.Fs` (Overlay + Base).
    - Maps `Issue` objects to `protocol.Diagnostic`.
    - Handles transport via `glsp` (stdio).

### 2. FileSystem Abstraction (`afero.Fs`)
To support unsaved changes in the IDE, all file I/O must be abstracted.
- **CLI Mode**: Direct disk access.
- **LSP Mode**: A custom `OverlayFs` that checks in-memory buffers (updated via `textDocument/didChange`) before falling back to the physical disk.

### 3. Safety: Stdout Pollution Prevention
The LSP uses `os.Stdout` for JSON-RPC messages. Any accidental `fmt.Println` or library log will crash the server.
- **Enforcement**: Add `forbidigo` to `.golangci.yml` to prevent use of `fmt.Print` and `os.Stdout` in the `internal/` packages.
- **Redirection**: In the `serve` command entry point, `os.Stdout` should be redirected to `os.Stderr` to catch accidental output, while the LSP server explicitly uses the original stdout descriptor.

## Implementation Details

### 1. Location-Aware Frontmatter Parsing
- Refactor `internal/scan/frontmatter.go` to use `gopkg.in/yaml.v3`.
- Parse into `yaml.Node` to preserve line and column numbers.
- Create a `LocationResolver` that maps byte offsets to LSP-compatible `Range` (line/character).

### 2. Audit Engine Refactoring
- Update `audit.Rule` interface to return `[]Issue`, where `Issue` includes `Range` information.
- Categorize rules into:
    - **`FileScope`**: Can be run on a single file buffer (e.g., syntax errors, missing fields).
    - **`WorkspaceScope`**: Requires a full repository scan (e.g., config conflicts).

## Features

### Phase 1: Diagnostics
- **Trigger**: `didOpen`, `didSave`, and debounced `didChange`.
- **Output**: Squiggly underlines for frontmatter errors, invalid keys, and rule violations.

### Phase 2: Navigation & Tooling (Low Hanging Fruit)
- **Hover**: Show tool descriptions and documentation links from the `Registry` when hovering over a `toolId`.
- **Go to Definition**: Jump from a `toolId` reference in a config file to its definition in the registry or `AGENTS.md`.
- **Document Symbols**: Show a tree view of all configuration blocks found in the current workspace.

### Phase 3: Automation
- **Code Actions**: Provide "Quick Fix" suggestions to generate missing configuration files or fix common frontmatter typos.

## Implementation Roadmap

1.  **Foundation**:
    - Add `github.com/tliron/glsp` and `github.com/spf13/afero`.
    - Setup `forbidigo` linter.
2.  **Parser Update**: Implement `yaml.Node` based frontmatter parsing.
3.  **Core Refactor**: Inject `Fs` abstraction into `Scanner` and `AuditEngine`.
4.  **LSP Scaffold**: Implement `markdowntown serve`.
5.  **Diagnostic Loop**: Wire up file changes to real-time audit diagnostics.
6.  **Navigation**: Implement Hover and Definition providers.