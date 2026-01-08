# Context Command Analysis & Risk Assessment

## 1. File Walking Risks
The current `scan.Scan` implementation in `cli/internal/scan/scanner.go` is **eager**. It recursively walks the entire repository and configured user roots to discover all configuration files upfront.

**Risks for TUI:**
- **Performance:** On large repositories (monorepos, Linux kernel), an eager scan will block the TUI startup for seconds or minutes.
- **Memory:** Keeping the entire file tree in memory (if naively implemented) is wasteful.
- **Responsiveness:** The UI needs to be responsive. A background eager scan might saturate I/O.

**Recommendation:**
- Do **not** use `scan.Scan` to populate the file tree.
- Implement a **Lazy File Walker** that uses `afero.ReadDir` only for the currently expanded directories.
- Use `scan.Scan` logic only for *discovery* of config files, perhaps running it asynchronously to decorate the file tree with icons/indicators later.

## 2. The "Merging" Challenge
The current system (`instructions.Adapter`) resolves context **per-client** (Codex, Gemini, VSCode, etc.).
The requirement "Select file to see resolved context from Gemini, Cloud Code, and Codex" implies a unified view.

**Conflict Scenarios:**
- **File Overlaps:** A file might be ignored by `.geminiignore` but included by `.codexignore`.
- **Instruction Conflicts:** `.gemini/instructions.md` says "Always use TypeScript", while `.codex/instructions.md` says "Use JavaScript".
- **Precedence:** If we merge these into a single "Context" view, which one takes precedence?

**Recommendation:**
- **Avoid Merging Logic:** Do not attempt to synthesize a single "Truth" from multiple AI clients unless explicitly requested.
- **Tabbed/Split View:** The TUI should present context as **Client-Specific Views**.
  - Tab 1: Codex (Resolved Instructions, Ignored Status)
  - Tab 2: Gemini (Resolved Instructions, Ignored Status)
- **Meta-Resolution (Optional):** If a "Unified" view is required, define a strict **Client Priority** (e.g., `CLI Flag > VSCode Settings > Codex > Gemini`).

## 3. Error Handling Strategy
Malformed configuration files (e.g., syntax error in `config.toml`, invalid JSON in `settings.json`) currently result in warnings during a scan.

**Risks:**
- **Silent Failures:** In a TUI, a missing context due to a syntax error might look like "No instructions found," confusing the user.
- **UX:** Users need to know *where* to fix the config.

**Recommendation:**
- **Explicit Error State:** The `ContextEngine` should return an `Error` object for a context source if parsing fails, not just an empty result.
- **UI Indication:** The TUI tree should mark files/dirs with a "Warning" icon if their contributing config files are malformed.
- **Diagnostics:** The context panel should show the raw error message (e.g., "Parse error in .codex/config.toml at line 5").

## 4. Symlinks & Boundaries
- **Circular Loops:** The TUI walker must track visited paths (by device/inode) to prevent infinite recursion, similar to `walkState` in `scanner.go`.
- **Escaping Root:** Symlinks pointing outside the repo should be handled carefully (follow or ignore based on config), mimicking `safeopen` logic.

## 5. Context JSON output
- `markdowntown context --json` now emits structured output for all clients (Gemini, Claude, Codex, Copilot, VS Code).
- Schema: `schemaVersion`, `repoRoot`, `filePath`, and `clients` map keyed by client name, each with `applied` `{ path, scope, reason }`, `warnings` array, and `error` string or `null`.
- All five client entries are always present to keep the shape stable for consumers.
