# Instruction Adapters (v1)

## Purpose

Provide a deterministic, documented model of how each client discovers and applies instruction files. Adapters must report conflicts and undefined ordering so the suggestion engine can fail closed.

## Adapter Contract (v1)

### Inputs

- `client`: codex | copilot | vscode | claude | gemini
- `repoRoot`: absolute path
- `cwd`: absolute path
- `targetPath`: optional file path for `resolve`
- `settings`: client-specific toggles (e.g., VS Code instruction files enabled)

### Outputs

- `applied[]`: ordered list of instruction files with metadata
- `orderGuarantee`: deterministic | undefined
- `conflicts[]`: conflict records with source files + reasons
- `settingsRequired[]`: gating settings that must be enabled
- `sizeLimits[]`: max bytes or truncation rules

## Conflict Policy

- If ordering is undefined or conflicts are explicitly nondeterministic, emit conflicts and suppress suggestions that depend on order.
- If multiple instruction sources overlap with contradictory imperatives, emit conflicts and omit suggestions.

---

## Behavior Matrix (v1)

| Client | Discovery roots | Traversal | Merge/order | Overrides | Size limits | Settings gates |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | Global `CODEX_HOME` + repo | Ancestor walk | Deterministic; later overrides earlier | `AGENTS.override.md` overrides `AGENTS.md` in same dir | `project_doc_max_bytes` | None |
| Copilot | Repo only | Repo-wide + path-specific | **Nondeterministic** when conflicts between repo-wide and path-specific | `AGENTS.md` nearest-wins; `excludeAgent` | Code review reads first 4k chars | None |
| VS Code | Repo only | Combined instruction types | **Undefined order** across types | Same as Copilot file types | No explicit size cap | Requires `github.copilot.chat.codeGeneration.useInstructionFiles` |
| Claude Code | User + repo | Hierarchical memory + rules modules | Deterministic hierarchy | `CLAUDE.local.md` | No explicit size cap | None |
| Gemini CLI | Global + repo | Ancestors + subtree scan | Concatenate all found | `.geminiignore` | No explicit size cap | None |

## Client Notes & Sources

### Codex

- Instruction chain includes per-directory `AGENTS.md` with `AGENTS.override.md` precedence. Fallback filenames can be configured in `config.toml`. Size caps enforced via `project_doc_max_bytes`.
- Source: <https://developers.openai.com/codex/guides/agents-md/>
- Source: <https://developers.openai.com/codex/config-reference>

### GitHub Copilot

- Repo-wide and path-specific instructions live under `.github/` with `applyTo` frontmatter; conflicts may be nondeterministic.
- Agent instructions: `AGENTS.md` nearest ancestor; or root-level `CLAUDE.md`/`GEMINI.md`. `excludeAgent` is supported.
- Source: <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions>
- Source: <https://docs.github.com/copilot/concepts/about-customizing-github-copilot-chat-responses>

### VS Code (Copilot Chat)

- Instruction file types are combined without guaranteed ordering; nested `AGENTS.md` is experimental.
- Instruction files require `github.copilot.chat.codeGeneration.useInstructionFiles`.
- Source: <https://code.visualstudio.com/docs/copilot/customization/custom-instructions>

### Claude Code

- Memory hierarchy includes project, user, and local; `.claude/rules` supports modular rules with path scoping; imports ignore code blocks/spans.
- Source: <https://docs.claude.com/en/docs/claude-code/memory>

### Gemini CLI

- Loads global `~/.gemini/GEMINI.md`, ancestor walk to repo root, and subtree scan below cwd; respects `.gitignore` and `.geminiignore`.
- Context filenames are configurable in settings.
- Source: <https://geminicli.com/docs/cli/gemini-md/>
