# Instruction Health Check UI Spec

## Goal
Help a new user validate instruction file placement for Claude Code, Codex CLI, and Copilot CLI with a fast, local-only health check and clear fixes.

## Summary Status Model
- **Pass**: No issues detected for selected tool.
- **Warn**: Issues exist but tool can still operate (e.g., extra files, mixed tool layout).
- **Fail**: Required instruction files are missing or misplaced.

### Severity Labels
- `error` -> Fail
- `warning` -> Warn
- `info` -> Neutral guidance (no status impact)

## Layout
### Desktop
Left: Scan setup (existing panel).
Right: Results stack in this order:
1. **Instruction Health** (new) – summary + issues + fix actions.
2. **Summary** (existing report/copy/download).
3. **Insights** (expected/missing/extra/precedence).

### Mobile
- Stack all panels vertically.
- Summary card above issues list.
- Fix actions appear as a single row of buttons under each issue (wrap on small screens).

## Instruction Health Panel
### Header
- Title: "Instruction health"
- Subcopy: "Validates file placement for the selected tool. Local-only."

### Summary Row
- Status pill (Pass/Warn/Fail).
- Counts: "0 errors / 2 warnings".
- CTA (secondary): "Copy fix summary".

### Issues List
Each issue card includes:
- Severity icon + label.
- Short message (plain language).
- Suggested fix (1 line).
- Optional actions: Copy template, Open Workbench, Show example path.

### Empty State
- Title: "Everything looks good"
- Body: "No placement issues detected for this tool."
- Secondary: "Try another tool" (link to tool selector).

## Copy Guidelines
### Tone
- Plain language, no jargon.
- Give a single, concrete action.

### Examples
- Missing root file:
  - "Missing AGENTS.md at repo root. Add it to set global instructions."
- Wrong folder:
  - "Copilot CLI reads .github/copilot-instructions/. Move scoped files there."
- Missing cwd:
  - "Set your current directory to where the tool runs (e.g., src/app)."

## CTA Hierarchy
- Primary action inside each issue: "Copy template" (if available).
- Secondary: "Open Workbench" with target preselected.
- Tertiary: "Show example path".

## Accessibility
- Use semantic lists for issues.
- Status pill should include text label (not color-only).
- Buttons must have clear aria-labels when icons are used.

## Motion/Feedback
- Success state: subtle highlight on summary card.
- Copy actions: inline toast "Copied" (3s).

## Edge Cases
- Mixed tool files: show warning, not error, with "You have files for multiple tools".
- Case mismatch: show error and expected casing.
- Truncated scan: warn that results may be incomplete.
