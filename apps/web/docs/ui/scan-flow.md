# Scan-First UX Flow

Date: 2025-12-28
Scope: Atlas Simulator scan flow (first-time user to value).

## Goals
- Help first-time users validate their instruction files quickly.
- Keep scanning local-only with clear privacy messaging.
- Deliver a clear "what next" path into Workbench.

## Primary entry points
- Global nav: Scan → `/atlas/simulator`
- Home CTA: Scan a folder
- Library empty state: link to Scan if no artifacts found
- Docs: Scan quickstart

## Target outcomes
- User understands which instruction files were found or missed.
- User sees a short list of fixes (missing patterns).
- User can move into Workbench to compile/export.

## Step-by-step flow (default path)
1. **Entry and framing**
   - Page headline: "Scan a folder"
   - Subhead: "Preview which instruction files a tool would load."
   - Local-only callout visible above the CTA.
2. **Scan a folder**
   - Primary CTA: "Scan a folder" (Directory Picker).
   - Secondary: "Upload folder" when picker is unavailable.
   - Disable the CTA while the picker is open to prevent duplicate picker errors.
   - Advanced controls (tool selector + cwd input) collapsed by default.
3. **Auto-detect tool + cwd**
   - After scan completes, detect likely tool based on instruction files.
   - Suggest a cwd when nested paths are detected.
   - Allow overrides via Advanced controls.
4. **Results summary**
   - Summary card: loaded, missing, extra, warnings.
   - Show missing patterns first with fix suggestions.
   - Order: Summary → Next steps → Instruction health → Files list.
5. **Next steps**
   - Primary action: "Open Workbench" once results are ready.
   - Secondary action: "Rescan with different tool" / "Adjust CWD"
   - Tertiary: "Download report" or "Copy summary"

## Key UI elements and copy requirements
- Local-only messaging above the CTA (no uploads, processed in browser).
- "What we look for" list: AGENTS.md, .github/copilot-instructions.md, etc.
- Missing patterns explained in plain language (why they matter).
- Results summary uses user-facing labels (not internal names).
- Ready state copy explicitly points to Workbench as the next step to export agents.md.

## Empty and error states
- Empty folder: show "No instruction files found" + suggested fixes.
- Unsupported picker: show "Upload folder" fallback and explain limitation.
- Permission denied: "Access denied" with retry hint.
- Truncated scan: show "Scan truncated" + suggest narrowing directory.
- Unknown tool: show default patterns and allow user to choose tool.
- Mixed tools: explain multiple formats found and prompt tool selection.

## Acceptance metrics (for UX validation)
- Time to first insight: < 60 seconds from landing.
- Completion rate: > 70% reach results panel after landing.
- CTA conversion: > 40% click through to Workbench after scan.
- Error recovery: > 60% recover from permission errors or empty scans.

## Instrumentation
- scan_start (tool, cwd, picker_type)
- scan_complete (loaded_count, missing_count, warning_count, truncated)
- scan_error (type, reason)
- scan_next_step_click (cta, tool, missing_count)

## Feature flags
- Local QA flags: see `docs/DEV_ONBOARDING.md#scan-flow-qa-flags`.
