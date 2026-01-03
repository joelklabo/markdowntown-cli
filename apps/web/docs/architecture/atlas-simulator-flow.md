# Atlas Simulator Folder Flow Audit

## Purpose
Document the end-to-end flow for scanning a local repo folder (instructions files) and simulating which files a tool would load, plus requirements, edge cases, and a test plan.

## Primary User Journey
1. **Navigate**: Home → Atlas → Simulator (`/atlas/simulator`).
2. **Choose tool**: Select a target (GitHub Copilot, Copilot CLI, Codex CLI, Claude Code, Gemini CLI).
3. **Choose repo source**:
   - **Manual**: Paste repo file paths (one per line).
   - **Folder**: Pick a local repo folder (File System Access API) and scan it locally.
4. **Set cwd** (if tool uses ancestor scanning): Enter a directory inside the repo (e.g., `packages/app`).
5. **Simulate**: Run simulation to see ordered loaded files and warnings.
6. **Interpret**: Use empty states/warnings to understand missing files or precedence/coverage gaps.
7. **Take action**: Copy/download a summary, adjust paths, or change tool and re-run.

## Functional Requirements
- **Repo input modes**
  - Manual paths text area (existing).
  - Folder scan using File System Access API (`showDirectoryPicker` + recursive scan).
  - Fallback for unsupported browsers (directory input with `webkitdirectory`).
- **Simulation behavior**
  - Uses `simulateContextResolution` and tool-specific rules.
  - Honors cwd ancestor scanning for Codex/Claude/Gemini.
  - Includes warnings for large trees and heavy `.cursor/rules` counts.
- **Output clarity**
  - Show ordered loaded files with reasons.
  - Clear empty states when no files match for a tool.
  - Highlight missing/expected patterns and precedence rules (insights panel).
- **Privacy**
  - Folder scans remain local; do not upload file contents.
  - UI messaging and policy pages reflect local-only scanning.

## Non-Functional Requirements
- **Performance**
  - Cap scans (e.g., 5000 files) with truncation messaging.
  - Ignore heavy directories (`node_modules`, `.git`, `.next`, etc.).
- **Reliability**
  - Gracefully handle canceled folder picker and permission errors.
  - Deterministic results given a repo tree + tool + cwd.
- **Accessibility**
  - Labels and descriptions for all inputs.
  - Results lists are readable by screen readers.
  - Buttons operable via keyboard; empty states announced.

## Edge Cases & Error Scenarios
- **Folder picker unsupported**: Fallback to `webkitdirectory` input; show messaging.
- **User cancels picker**: No error toast; leave prior scan intact.
- **Permission error**: Show a clear error and how to retry.
- **Empty scan**: 0 files scanned; show “no files found” guidance.
- **No instruction files**: Tool-specific guidance for missing patterns.
- **Truncated scan**: Show that scan was capped; indicate counts.
- **Mixed path casing / Windows slashes**: Normalize path separators and trim `./` prefixes.
- **Cwd missing**: For ancestor scanning tools, warn that cwd is required for accurate results.

## Security & Privacy Considerations
- Never transmit file contents or names to the server.
- Scans should only read file paths, not file contents.
- Update Terms/Privacy to explicitly state local-only scanning.

## Testing Plan
- **Unit**
  - `scanRepoTree` ignores directories, caps scan size, and returns metadata.
  - `fileListScan` translates `webkitRelativePath` into repo-relative paths.
  - `simulateContextResolution` remains deterministic and warning logic is stable.
  - New insights helper covers each tool + cwd scenarios.
- **Component**
  - `ContextSimulator` manual and folder modes render correctly.
  - Folder scanning UI shows metadata and empty/error states.
  - Insights panel renders missing/expected patterns.
- **E2E**
  - Vitest E2E (Playwright API under the hood) stubs `showDirectoryPicker` and runs the full scan + simulate loop.
  - Run with `E2E_BASE_URL=http://localhost:3000 npm run test:e2e -- AtlasSimulatorFlow` (skip when no dev server is running).
  - Switching tools updates loaded files and insights.

## Risks
- Browser support differences for folder picking.
- Very large repos can hit file count caps and produce incomplete results.
- User confusion if cwd is missing for ancestor-based tools.

## Follow-Up Opportunities
- Add a lightweight “diff” view between tools for the same repo tree.
- Provide exportable JSON report for CI or docs.
- Add instrumentation for scan performance and error rates.
