# Simplified scan flow (folder upload quickstart)

## Objective
Reduce time-to-value by letting a first-time user upload a folder and immediately receive a tool recommendation, summary of what was detected, and clear next steps.

## Flow overview
1. **Idle state**
   - Primary CTA: “Scan a folder”.
   - Secondary CTA: “Paste paths”.
   - Helper text: local-only scan, no uploads. “File contents never leave your device.”
   - Advanced controls collapsed by default.

2. **Upload → scan (automatic)**
   - User picks a folder (Directory Picker or `webkitdirectory` fallback).
   - Scan begins immediately and reports progress.
   - If the user cancels, return to idle state with a gentle message.

3. **Auto-detect tool + cwd**
   - After scan completes, detect likely tool based on known instruction files.
   - Infer cwd when possible (e.g., if instructions live under a nested path).
   - If multiple tools are detected, prompt the user to choose.
   - Show detected values with visible override controls.

4. **Results + summary**
   - Summarize: tool detected, number of instruction files found, missing critical files.
   - Show prioritized next steps (copy template, open docs, rescan smaller scope).
   - Include a primary CTA to open Workbench with scan context when ready; errors keep recovery CTAs primary.

5. **Advanced controls (optional)**
   - Tool selector, cwd input, manual paths input, and content linting opt-in.
   - Only shown after “Show advanced” toggle.

## Detection heuristics
- **Exact matches (high confidence):**
  - `AGENTS.md` / `AGENTS.override.md` → Codex CLI.
  - `CLAUDE.md` → Claude Code.
  - `GEMINI.md` → Gemini CLI.
  - `.github/copilot-instructions.md` → GitHub Copilot / Copilot CLI.
  - `.github/agents/*` or `.github/copilot-instructions/**/*.instructions.md` → Copilot CLI.
- **Tie-break rules:**
  - Prefer exact root files over scoped files.
  - If multiple tools are present, mark as “mixed” and request confirmation.
  - If only scoped files exist, prefer the tool that owns that directory structure.

## Error and recovery states
- **Folder picker unsupported:**
  - Show folder upload input with `webkitdirectory` and keep flow identical.
- **Scan canceled:**
  - Show “Scan canceled” message and return to idle state.
- **Scan error:**
  - Show error panel with “Try again” CTA.
- **Permission denied:**
  - Show “Allow access” CTA and explain access is required to scan.
- **Empty scan (no instruction files):**
  - Show “Copy template” CTA and explain a root file is required.
- **Large repo truncated:**
  - Warn and suggest scanning a smaller folder; allow Workbench with caution copy.
- **Mixed-tool detection:**
  - Show a tool picker prompt and explain why.

## Copy requirements
- “Scan a folder to see what your tool will load. Scans stay in your browser.”
- “We detected **{tool}** based on **{file}**. Change if needed.”
- “Found {countFound} instruction files. {countMissing} expected files missing.”
- “Next steps: copy a template, open docs, or rescan a smaller folder.”
- Primary CTA: “Scan a folder”

## Notes for refactoring opportunities
- If duplicate scan logic exists between picker and input, consolidate.
- Remove legacy helper copy that conflicts with the quick upload flow.
