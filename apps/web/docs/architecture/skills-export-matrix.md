# Skills export matrix

This matrix documents how Skills (UAM v1 capabilities + blocks) are exported per target adapter.

## Target ids
- Codex CLI: `agents-md`
- Copilot CLI: `github-copilot`
- Claude Code: `claude-code`

## Export mappings

### Codex CLI (agents-md)
- Adapter: `agentsMdCodexAdapter` (`agents-md@1`)
- Global scope → `AGENTS.md`
- Dir scopes → `<dir>/AGENTS.md`
- Glob scopes → not supported (skipped with warning)
- Blocks are concatenated per file, separated by blank lines
- Capabilities are not exported

### Copilot CLI (github-copilot)
- Adapter: `githubCopilotAdapter` (`github-copilot@1`)
- Global scope → `.github/copilot-instructions.md`
- Glob scopes → `.github/instructions/<slug>.instructions.md` with `applyTo` frontmatter
- Dir scopes → not supported (skipped with warning)
- Blocks are concatenated per file
- Capabilities are not exported

### Claude Code (claude-code)
- Adapter: `claudeCodeAdapter` (`claude-code@1`)
- Global scope → `CLAUDE.md` (blocks separated by `---`)
- Dir scopes → `.claude/rules/<slug>.md`
- Glob scopes → `.claude/rules/<slug>.md`
- Capabilities → `.claude/skills/<capability-id>/SKILL.md` when enabled

Skill export configuration via target options:
- Export all skills: `{ "exportSkills": true }`
- Export allowlist: `{ "skills": ["skill-id-1", "skill-id-2"] }`
- `options.exportSkills` can also be an array (treated as allowlist)

## Validation constraints
- Target IDs must resolve in adapter registry.
- Dir/glob scopes may be skipped for targets that cannot represent them.
- Duplicate scope ids are rejected by UAM validation.
- Duplicate scope file paths may be merged (agents-md, claude-code).

## Output collision handling
- File path collisions are surfaced as compile warnings and should be shown in UI.
- For rules files, name collisions are resolved by suffixing `-2`, `-3`, etc.
