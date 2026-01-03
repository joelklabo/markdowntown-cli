# Scan Results Next Steps Spec

This spec defines how the Atlas Simulator results page should guide first-time users toward the correct next action. The goal is to reduce ambiguity after a scan and make the next fix obvious.

## Goals
- Make the next action unambiguous for first-time users.
- Prioritize the highest-impact fix first (errors > warnings > info).
- Make “Open Workbench” the default primary CTA once the scan is ready.
- Keep privacy/local-only messaging clear and consistent.
- Keep CTAs short and action-oriented.

## Non-goals
- Changing scan/diagnostic algorithms.
- Uploading or storing file contents server-side.

## Inputs and signals
- `tool` (selected tool id)
- `repoSource` (folder scan vs manual paths)
- `cwd` (current directory)
- `isStale` (inputs changed since last run)
- `scanMeta` (total files, matched files, truncated, root name)
- `instructionDiagnostics` (errors/warnings/info)
- `insights` (expected patterns, missing files, precedence notes)
- `extraFiles` (instruction files not matched to tool)
- `warnings` (e.g., large tree)

## Step model
Each step should include:
- `severity`: error | warning | info | ready
- `title`: short imperative
- `body`: plain-language explanation + impact
- `primaryAction`: label + action id (optional)
- `secondaryActions`: optional list

Ordering rules:
1. Stale-results state overrides other steps and must appear first.
2. Errors next (max 2 shown by default, with “Show all” if more).
3. Warnings next (max 2 by default).
4. Info steps last.
5. Ready state shows a single “All set” step (no errors/warnings).

## CTA hierarchy
- Primary CTA: a single, high-impact action that fixes the top issue (or “Open Workbench” when ready).
- Secondary CTAs: learn more, copy summary, download report, adjust tool/cwd.
- Avoid more than 2 CTAs in one step.
- Error states hide or disable “Open Workbench” until blocking issues are resolved.
- Warning states may include “Open Workbench anyway” as a secondary CTA when the scan is usable but incomplete.

CTA style guidance:
- Primary: solid button (e.g., “Open Workbench”, “Copy template”, “Scan a folder”, “Refresh results”).
- Secondary: ghost/outline (e.g., “Open docs”, “Copy summary”, “Download report”).

## State matrix (summary)

| State | Severity | Primary CTA | Can enter Workbench? |
| --- | --- | --- | --- |
| No scan yet | info | Scan a folder | No |
| Stale results | warning | Refresh results | No (until refreshed) |
| Permission denied | error | Allow access | No |
| Missing root instructions | error | Copy template | No |
| Empty scan | error | Add root file | No |
| Missing cwd | warning | Set cwd | Yes (secondary) |
| Override without base | warning | Copy base template | Yes (secondary) |
| Mixed tools detected | warning | Switch tool | Yes (secondary) |
| Large tree warning | warning | Scan a smaller folder | Yes (secondary) |
| Ready state | ready | Open Workbench | Yes |


## Layout guidance (wireframe)
Desktop:
- Place the Next steps panel near the top of Results, directly beneath the scan summary.
- Use a card with a clear header ("Next steps") and a short helper line ("Start here to fix the biggest issue").
- Each step row: severity pill on the left, title + body stacked, CTA row aligned to the right or under the body.
- Default spacing: 12-16px between steps, 16-20px between title and body, 8-12px between CTAs.
- If more than 4 steps, show the first 3 and a "Show all" toggle.

Mobile:
- Stack CTAs vertically (full-width buttons).
- Keep severity pill and title on one line; body below.
- Collapse step list after 2 items with "Show all" to reduce scroll.

## Example panel copy (design reference)
- Missing root instructions
  - Title: "Add the root instruction file"
  - Body: "This tool won't load any instructions without a root file."
  - Primary: "Copy template"
  - Secondary: "Open docs"
- Mixed tools detected
  - Title: "Multiple tool formats detected"
  - Body: "You may be scanning the wrong tool or have extra files for other CLIs."
  - Primary: "Switch tool"
  - Secondary: "Review extra files"
- Stale results
  - Title: "Results are out of date"
  - Body: "Your inputs changed. Re-run to refresh guidance."
  - Primary: "Refresh results"
  - Secondary: "Copy summary"
- Ready state
  - Title: "You're ready to go"
  - Body: "These files should load for the selected tool. Open Workbench to build and export agents.md."
  - Primary: "Open Workbench"
  - Secondary: "Copy summary", "Download report"

## State definitions and copy

### 1) No scan yet
**When:** `repoSource=folder` and no scan tree, or manual paths empty.
- Title: “Scan your repo to get next steps”
- Body: “Pick a folder (or paste paths) so we can see which instructions load.”
- Primary CTA: “Scan a folder” (or “Upload folder” if picker unsupported)
- Secondary CTA: “Paste repo paths” (opens Advanced)

### 2) Stale results
**When:** `isStale=true`.
- Title: “Results are out of date”
- Body: “Your inputs changed. Re-run to refresh guidance.”
- Primary CTA: “Refresh results”
- Secondary CTA: “Copy summary” (optional)

### 3) Permission denied (error)
**When:** folder picker returns an access error or permission is denied.
- Title: “Allow folder access”
- Body: “We can’t scan without read access. Allow access to continue.”
- Primary CTA: “Allow access” (re-open picker)

### 4) Missing root instructions (error)
**When:** diagnostics include missing root file (e.g., `missing.agents`, `missing.claude`).
- Title: “Add the root instruction file”
- Body: “This tool won’t load any instructions without a root file.”
- Primary CTA: “Copy template”
- Secondary CTA: “Open docs”

### 5) Empty scan (error)
**When:** scan completed but no instruction files found.
- Title: “No instruction files found”
- Body: “Add a root instruction file so the tool can load instructions.”
- Primary CTA: “Copy template”
- Secondary CTA: “Open docs”

### 6) Missing cwd (warning)
**When:** diagnostics include `missing-cwd`.
- Title: “Set the current directory (cwd)”
- Body: “Ancestor scans depend on where the tool runs. Set cwd so we load the right instructions.”
- Primary CTA: “Set cwd” (focus the input)

### 7) Override without base (warning)
**When:** diagnostics include `override-without-base`.
- Title: “Add a base file for overrides”
- Body: “Overrides replace a base file in the same folder. Add the base file so the override is valid.”
- Primary CTA: “Copy base template”

### 8) Mixed-tool instructions (warning)
**When:** diagnostics include `mixed-tools`.
- Title: “Multiple tool formats detected”
- Body: “You may be scanning the wrong tool or have extra files for other CLIs.”
- Primary CTA: “Switch tool” (open tool selector)
- Secondary CTA: “Review extra files” (scroll to extra list)

### 9) Large tree warning
**When:** warning `scan-risk.large-tree`.
- Title: “Limit the scan scope”
- Body: “Large repos can bloat context. Consider scanning a narrower folder or proceed with partial results.”
- Primary CTA: “Scan a smaller folder”
- Secondary CTA: “Paste repo paths”

### 10) Ready state
**When:** no errors/warnings.
- Title: “You’re ready to go”
- Body: “These files should load for the selected tool. Open Workbench to build and export agents.md.”
- Primary CTA: “Open Workbench”
- Secondary CTA: “Copy summary”, “Download report”

## Section helper text updates
Use short, action-oriented copy beneath section headings:
- Summary: “Quick snapshot—what loads and what’s missing.”
- Loaded files: “These files will load for the selected tool based on your cwd.”
- Warnings: “Non-blocking issues that can still affect results.”
- Expected patterns: “Where this tool looks for instruction files.”
- Missing files: “Patterns that were expected but not found.”
- Extra files: “Instruction files for other tools or unused paths.”
- Precedence notes: “Which files override or win when multiple are found.”

## Privacy messaging (results area)
Always include (or link to) a short reminder:
- “Scans run locally in your browser. File contents are never uploaded.”
- Place the reminder above the fold (near the summary or Next steps header).

## Examples by tool (abbreviated)
- Codex CLI: root `AGENTS.md` missing -> “Copy AGENTS.md template.”
- Claude Code: missing `CLAUDE.md` -> “Add CLAUDE.md at repo root.”
- Gemini CLI: missing `GEMINI.md` -> “Add GEMINI.md at repo root.”
- Copilot CLI: missing `.github/copilot-instructions.md` -> “Copy Copilot CLI template.”
- GitHub Copilot: missing `.github/instructions/*.instructions.md` -> “Open docs for scoped rules.”

## Refactoring/bug-fix reminder
While implementing this spec, always watch for refactoring opportunities, bug fixes, and improvements. Create new bd tasks when discovered.
