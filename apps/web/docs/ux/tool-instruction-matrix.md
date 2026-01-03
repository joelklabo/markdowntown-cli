# Tool Instruction Matrix

## Codex CLI

| Rule | Expected Path(s) | Notes | Common Mistakes |
| --- | --- | --- | --- |
| Repo instructions | `AGENTS.md` | Loaded from repo root. | `agents.md` (case), placed under `.github/`. |
| Directory overrides | `AGENTS.override.md` | Overrides `AGENTS.md` in the same directory. | Misspelling or wrong casing. |
| Directory scopes | `*/AGENTS.md` | Ancestor walk from cwd to repo root; deeper directories take precedence. | Missing cwd or using absolute paths in cwd input. |


## Claude Code

| Rule | Expected Path(s) | Notes | Common Mistakes |
| --- | --- | --- | --- |
| Repo memory | `CLAUDE.md` | Loaded from repo root. | `Claude.md` (case), placed under `.github/`. |
| Directory scopes | `*/CLAUDE.md` | Ancestor walk from cwd to repo root; closer files take precedence. | Missing cwd, expecting a single file to apply everywhere. |


## Copilot CLI

| Rule | Expected Path(s) | Notes | Common Mistakes |
| --- | --- | --- | --- |
| Repo instructions | `.github/copilot-instructions.md` | Primary repository-wide file. | Using `.github/instructions/` (GitHub Copilot UI path). |
| Scoped instructions | `.github/copilot-instructions/**/*.instructions.md` | Path-scoped rules; should include `applyTo` front matter. | Wrong folder, missing `.instructions.md` suffix. |
| Agent profiles | `.github/agents/*` | Optional agent profiles. | Placed at repo root or under `.copilot/`. |


## GitHub Copilot (UI)

| Rule | Expected Path(s) | Notes | Common Mistakes |
| --- | --- | --- | --- |
| Repo instructions | `.github/copilot-instructions.md` | Shared with Copilot CLI. | Name mismatch (copilot-instruction.md). |
| Scoped instructions | `.github/instructions/*.instructions.md` | UI scoped rules; uses `applyTo`. | Placed under `.github/copilot-instructions/`. |


## Cross‑Tool Pitfalls
- Mixing `/.github/instructions/` and `/.github/copilot-instructions/` without understanding which tool reads which folder.
- Relying on lowercase filenames for tools that require uppercase (AGENTS.md, CLAUDE.md, GEMINI.md).
- Missing cwd for tools that scan ancestor directories.
- Storing instructions under ignored directories (e.g., `.git`, `node_modules`).
