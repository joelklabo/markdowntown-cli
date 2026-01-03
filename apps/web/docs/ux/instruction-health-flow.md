# Instruction Health Check: User Journey

## Persona
- New user with an existing repo.
- Uses Claude Code, Codex CLI, and Copilot CLI, but isn’t sure whether instruction files are in the right place or formatted correctly.
- Wants a quick, local-only validation without uploading code.

## Primary Goal
Confirm that instruction files are discoverable by each tool and get clear, actionable fixes for any missing or misplaced files.

## Journey Map
### 1) Entry
- User lands on Atlas Simulator from Home/Docs.
- System highlights "Instruction Health Check" as the fastest way to validate placement.

### 2) Setup
- User selects a tool (Claude Code / Codex CLI / Copilot CLI).
- User sets current directory (cwd) if tool uses ancestor lookup.
- User scans a folder (preferred) or uploads a folder list (fallback).

### 3) Run Health Check
- System reads file paths locally and runs placement diagnostics.
- Summary shows Pass / Warn / Fail per tool.
- Issues list shows missing/misplaced files with recommended fixes.

### 4) Fixes
- User clicks "Copy template" for a missing file.
- User clicks "Open Workbench" to generate a correct file in the right path.
- User reruns the scan to verify fixes.

### 5) Optional Content Lint
- User opts in to local-only content linting.
- System flags common formatting problems (oversized instructions, missing setup/test commands, missing `applyTo` for scoped Copilot instructions).

### 6) Outcome
- User leaves with a validated instruction layout and confidence that tools will load the correct files.

## Decision Points
- Tool selection drives which paths are considered “expected.”
- cwd is required for tools that walk ancestor directories (Codex/Claude/Gemini).
- Folder scan vs. manual paths affects error messaging and troubleshooting.

## Failure Modes + UX Responses
- No instruction files found -> show tool-specific “what to add” guidance.
- Wrong folder (.github/instructions vs .github/copilot-instructions) -> show correction.
- Wrong filename or extension -> show expected filename and path.
- Missing cwd -> show a blocking warning and an inline example.
- Mixed tool setup -> warn about parallel instruction systems.

## Edge Cases
- Missing cwd for Codex/Claude (ancestor scan fails).
- Case-sensitive paths (e.g., agents.md vs AGENTS.md).
- Mixed tool folders in one repo (Copilot + Codex + Claude).
- Folder uploads that strip root name (relative path mismatches).
- Repo ignores (node_modules, .git) removing expected files from scan.

## Open Questions to Validate
- Which tools are most common for first-time users?
- Should the health check default to Copilot CLI or Codex CLI?
- Should we warn if multiple tools’ files are present in one repo?
