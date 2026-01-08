package scan

// DefaultRegistryJSON contains the built-in fallback patterns when no registry file is found.
// This is a minimal subset of cli/data/ai-config-patterns.json to ensure out-of-the-box functionality.
const DefaultRegistryJSON = `{
  "version": "1.0",
  "patterns": [
    {
      "id": "codex-agents-repo",
      "toolId": "codex",
      "toolName": "Codex",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["AGENTS.md"],
      "type": "glob",
      "loadBehavior": "all-ancestors",
      "application": "automatic",
      "docs": ["https://developers.openai.com/codex/guides/agents-md"]
    },
    {
      "id": "gemini-cli-instructions-repo",
      "toolId": "gemini-cli",
      "toolName": "Gemini CLI",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["**/GEMINI.md"],
      "type": "glob",
      "loadBehavior": "nearest-ancestor",
      "application": "automatic",
      "docs": ["https://github.com/google-gemini/gemini-cli/blob/main/docs/cli.md"]
    },
    {
      "id": "claude-code-instructions-repo",
      "toolId": "claude-code",
      "toolName": "Claude Code",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["CLAUDE.md"],
      "type": "glob",
      "loadBehavior": "all-ancestors",
      "application": "automatic",
      "docs": ["https://docs.anthropic.com/en/docs/claude-code/settings"]
    },
    {
      "id": "cursor-rules-file",
      "toolId": "cursor",
      "toolName": "Cursor",
      "kind": "rules",
      "scope": "repo",
      "paths": [".cursorrules"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://docs.cursor.com/context/rules"]
    },
    {
      "id": "cline-rules-file-repo",
      "toolId": "cline",
      "toolName": "Cline",
      "kind": "rules",
      "scope": "repo",
      "paths": [".clinerules"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://docs.cline.bot/prompting/clinerules"]
    },
    {
      "id": "aider-config-yml",
      "toolId": "aider",
      "toolName": "Aider",
      "kind": "config",
      "scope": "repo",
      "paths": [".aider.conf.yml"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://aider.chat/docs/config.html"]
    },
    {
      "id": "github-copilot-instructions",
      "toolId": "github-copilot",
      "toolName": "GitHub Copilot",
      "kind": "instructions",
      "scope": "repo",
      "paths": [".github/copilot-instructions.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot"]
    }
  ]
}
`
