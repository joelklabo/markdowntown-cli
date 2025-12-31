# markdowntown audit

Summary: 1 error(s), 3 warn(s), 1 info

## Errors
- [MDTAUDIT002] Frontmatter parse error: ./CLAUDE.md
  - Suggestion: Fix or remove YAML frontmatter so the file can be parsed.
  - Details: YAML frontmatter failed to parse.

## Warnings
- [MDTAUDIT001] Missing instructions for Aider: ./.aider.conf.yml
  - Suggestion: Add an instructions file for Aider or remove unused configs.
  - Details: Aider has configs but no repo-scope instructions were detected.
- [MDTAUDIT003] Empty config or instruction file: ./AGENTS.md
  - Suggestion: Add meaningful content or remove the empty file.
  - Details: File is empty and may be ignored by tools.
- [MDTAUDIT004] Config file is gitignored: ./.github/copilot-instructions.md
  - Suggestion: Remove it from .gitignore or relocate it to a tracked path.
  - Details: File is ignored by git and may not be shared with collaborators.

## Info
- [MDTAUDIT005] Tool requires a setting to activate instructions: ./.github/copilot-instructions.md
  - Suggestion: Enable github.copilot.chat.codeGeneration.useInstructionFiles to ensure GitHub Copilot instructions are applied.
  - Details: GitHub Copilot may require setting github.copilot.chat.codeGeneration.useInstructionFiles to enable instruction files.

