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
      "application": "automatic"
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
      "application": "automatic"
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
      "application": "automatic"
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
      "application": "automatic"
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
      "application": "automatic"
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
      "application": "automatic"
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
      "application": "automatic"
    }
  ]
}
`
