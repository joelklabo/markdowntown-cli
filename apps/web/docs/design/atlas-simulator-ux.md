# Atlas Simulator UX Spec

## Layout
- **Two-column layout** (desktop):
  - **Left: Inputs** (tool selector, repo source, cwd, repo tree/picker, simulate CTA).
  - **Right: Results** (Loaded files, Warnings, Insights, Actions).
- **Single column** (mobile): Inputs stacked above Results.

## Key Components
1. **Inputs panel**
   - Tool dropdown.
   - Repo source toggle: Manual paths vs. Local folder.
   - CWD text input with helper text.
   - Manual paths textarea OR folder picker + preview list.
   - Primary “Simulate” button.
2. **Scan meta summary** (when folder mode):
   - Total scanned files.
   - Matched instruction files.
   - Truncation status.
3. **Results panel**
   - Loaded files list with reasons.
   - Warnings list.
   - **Insights panel** (new): expected patterns, missing items, precedence notes.
   - **Actions**: Copy summary, Download report.

## Empty & Error States
- **Unsupported browser**
  - Message: “Folder picking isn’t supported in this browser. Use ‘Manual’ or upload via folder input.”
  - Provide fallback input if available (`webkitdirectory`).
- **Scan canceled**
  - Message: “No folder selected. Choose a folder to scan.”
  - Do not clear prior results.
- **Scan error**
  - Message: “Unable to scan folder. Check permissions and try again.”
- **Truncated scan**
  - Message: “Scan stopped at {maxFiles} files. Results may be incomplete.”
- **No files found**
  - Message: “No files detected. Choose a different folder or check permissions.”
- **No instruction files found**
  - Tool-specific prompts, e.g.:
    - Copilot: “Add .github/copilot-instructions.md or .github/instructions/*.instructions.md.”
    - Copilot CLI: “Add .github/copilot-instructions.md, .github/copilot-instructions/**/*.instructions.md, or .github/agents/*.”
    - Codex CLI: “Add AGENTS.md or AGENTS.override.md and set a cwd.”

## Insights Panel
- **Expected patterns** per tool (human-readable list).
- **Found** patterns (ordered list; link to “Loaded files”).
- **Missing** patterns (actionable tips).
- **Precedence notes** (e.g., scoped instructions override root instructions).

## Actions
- **Copy summary**
  - Copies a concise report: tool, cwd, loaded files, missing patterns, warnings.
- **Download report**
  - `.md` or `.txt` summary for sharing with teammates.

## Copy Guidelines
- Emphasize **local-only scanning**:
  - “Scans locally in your browser. File contents are never uploaded.”
- Keep warnings crisp and actionable.
- Use consistent tool naming: “GitHub Copilot”, “Copilot CLI”, “Codex CLI”, “Claude Code”, “Gemini CLI”.

## Accessibility Notes
- Inputs use `<label>` and `aria-describedby` for helper text.
- Lists have accessible names (e.g., `aria-label="Loaded files"`).
- Ensure focus order: inputs → simulate → results.
- Action buttons must be keyboard accessible and announce success via live region or toast.

## Visual Notes
- Use existing card styling and spacing tokens.
- Show subtle separators between result sections.
- Warnings should use muted tone with accent for emphasis.

