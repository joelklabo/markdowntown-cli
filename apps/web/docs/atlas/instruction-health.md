# Instruction health check

Use the Instruction health panel to confirm instruction files are in the right place for each tool and get actionable fixes.
Next steps in the Simulator surfaces the highest-impact Instruction health issues so you can act quickly.

## How to use
1. Open Atlas → Simulator and click **Upload a folder**.
2. Confirm the auto-detected tool/cwd (override in Advanced if needed).
3. Review the Instruction health status and fixes.
4. (Optional) Enable content linting to validate formatting locally.
5. If you can’t scan a folder, use **Paste paths** and set tool/cwd manually.

## Tool checklists

### Codex CLI (AGENTS.md)
- ✅ `AGENTS.md` exists at the repo root (case-sensitive).
- ✅ Optional scoped `AGENTS.md` files live in subfolders.
- ✅ If you use `AGENTS.override.md`, a matching `AGENTS.md` exists in the same folder.
- ✅ **cwd** is set to the folder where Codex CLI runs, and an ancestor contains `AGENTS.md`.
- ❌ Avoid lowercase `agents.md` — case mismatches are ignored.

### Claude Code (CLAUDE.md)
- ✅ `CLAUDE.md` exists at the repo root or a parent folder (case-sensitive).
- ✅ **cwd** is set so ancestor lookups can find memory files.
- ❌ Avoid `claude.md` or mismatched casing.

### Gemini CLI (GEMINI.md)
- ✅ `GEMINI.md` exists at the repo root or a parent folder (case-sensitive).
- ✅ **cwd** is set so ancestor lookups can find instructions.
- ❌ Avoid `gemini.md` or mismatched casing.

### Copilot CLI (.github/copilot-instructions)
- ✅ Root file exists: `.github/copilot-instructions.md`.
- ✅ Scoped files live under `.github/copilot-instructions/*.instructions.md`.
- ✅ Scoped files include `applyTo` front matter.
- ✅ Optional agents live under `.github/agents/`.
- ❌ Avoid placing scoped instructions in `.github/instructions/` (that’s for GitHub Copilot).
- ❌ Ensure scoped files end with `.instructions.md`.

### GitHub Copilot (.github/instructions)
- ✅ Root file exists: `.github/copilot-instructions.md`.
- ✅ Scoped files live under `.github/instructions/*.instructions.md`.
- ✅ Scoped files include `applyTo` front matter.
- ❌ Avoid placing scoped files in `.github/copilot-instructions/` (that’s for Copilot CLI).

## Content linting checklist (optional)
Content linting reads instruction files locally to surface common formatting issues.
- Add `applyTo` front matter for scoped Copilot instructions.
- Include install/test/lint commands in root instruction files.
- Keep instruction files under ~64 KB to avoid truncation or skips.

### Example `applyTo` front matter
```yaml
---
applyTo: "**/*.{ts,tsx}"
---
```

## Fix workflow
- Use **Copy template** to grab a starter file for the selected tool.
- Use the path chip to copy the expected file path.
- Re-run the scan and confirm the status changes to **Pass**.
- If the Next steps panel is visible, use it to jump straight to the highest-impact fix.
