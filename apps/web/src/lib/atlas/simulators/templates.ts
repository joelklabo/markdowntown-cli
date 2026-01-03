import type { SimulatorToolId } from "@/lib/atlas/simulators/types";

export type InstructionTemplate = {
  id: string;
  label: string;
  path: string;
  content: string;
};

export type InstructionTemplateMap = {
  root: InstructionTemplate;
  scoped: InstructionTemplate;
  override?: InstructionTemplate;
};

export const INSTRUCTION_TEMPLATES: Record<SimulatorToolId, InstructionTemplateMap> = {
  "codex-cli": {
    root: {
      id: "codex-root",
      label: "AGENTS.md (root)",
      path: "AGENTS.md",
      content: `# Example: \`AGENTS.md\`

## Your job
1. Pick a ready issue.
2. Set it to \`in_progress\`.
3. Implement the change.
4. Run tests and lint.
5. Mark the issue \`done\`.

## Conventions
- Prefer \`rg\` for searching.
- Use \`pnpm\` for scripts.
- Keep commits focused and descriptive.
`,
    },
    scoped: {
      id: "codex-scoped",
      label: "AGENTS.md (scoped)",
      path: "src/AGENTS.md",
      content: `# Example: scoped \`AGENTS.md\`

These instructions apply to files in this folder.

- Keep changes tight and scoped to this directory.
- Prefer local utilities over new shared abstractions.
`,
    },
    override: {
      id: "codex-override",
      label: "AGENTS.override.md",
      path: "AGENTS.override.md",
      content: `# Example: \`AGENTS.override.md\`

This file replaces \`AGENTS.md\` in the same directory.

- Use this when you want different instructions for a subfolder.
`,
    },
  },
  "claude-code": {
    root: {
      id: "claude-root",
      label: "CLAUDE.md (root)",
      path: "CLAUDE.md",
      content: `# Example: \`CLAUDE.md\`

Use this file to provide repository instructions to Claude Code.

## Engineering
- Prefer minimal changes and clear naming.
- Add tests for new behavior.
- Keep performance in mind; avoid unnecessary work in render paths.

## Commands
- Install: \`pnpm install\`
- Test: \`pnpm test\`
- Lint: \`pnpm lint\`
- Type-check: \`pnpm type-check\`
`,
    },
    scoped: {
      id: "claude-scoped",
      label: "CLAUDE.md (scoped)",
      path: "src/CLAUDE.md",
      content: `# Example: scoped \`CLAUDE.md\`

These instructions apply to this directory only.

- Focus on module-local changes.
- Document new utilities with clear comments.
`,
    },
  },
  "gemini-cli": {
    root: {
      id: "gemini-root",
      label: "GEMINI.md (root)",
      path: "GEMINI.md",
      content: `# Example: \`GEMINI.md\`

Use this file to provide project guidance to the Gemini CLI.

## Preferences
- Keep changes small and well-scoped.
- Prefer explicit imports and clear types.
- Run \`pnpm test\` before finalizing.

## Output
- Provide file paths and commands.
- Avoid long explanations unless asked.
`,
    },
    scoped: {
      id: "gemini-scoped",
      label: "GEMINI.md (scoped)",
      path: "src/GEMINI.md",
      content: `# Example: scoped \`GEMINI.md\`

These instructions apply to this folder.

- Keep module changes local.
- Avoid cross-package refactors unless requested.
`,
    },
  },
  cursor: {
    root: {
      id: "cursor-root",
      label: "Cursor rule (root)",
      path: ".cursor/rules/project.mdc",
      content: `---\ndescription: \"Project rules\"\nglobs: \"**/*\"\nalwaysApply: true\n---\n\n# Project rules\n- Keep changes small and reviewable.\n- Use pnpm for installs and scripts.\n- Run tests before finalizing changes.\n`,
    },
    scoped: {
      id: "cursor-scoped",
      label: "Cursor rule (scoped)",
      path: ".cursor/rules/components.mdc",
      content: `---\ndescription: \"Component-specific rules\"\nglobs: \"src/components/**/*.{ts,tsx}\"\n---\n\n# Component rules\n- Keep UI components focused and accessible.\n- Prefer existing UI primitives and tokens.\n`,
    },
  },
  "copilot-cli": {
    root: {
      id: "copilot-cli-root",
      label: "copilot-instructions.md (root)",
      path: ".github/copilot-instructions.md",
      content: `# Example: \`.github/copilot-instructions.md\`

Use this file to tell GitHub Copilot how to work in your repo.

## Working agreement
- Prefer small, reviewable diffs.
- Fix root causes; avoid band-aids.
- Run tests and linters before proposing changes.

## Project conventions
- Package manager: \`pnpm\`
- Tests: \`pnpm test\`
- Type-check: \`pnpm type-check\`
- Lint: \`pnpm lint\`

## Output style
- Be concise, direct, and actionable.
- When unsure, ask clarifying questions rather than guessing.
`,
    },
    scoped: {
      id: "copilot-cli-scoped",
      label: "copilot-instructions (scoped)",
      path: ".github/copilot-instructions/app.instructions.md",
      content: `---\napplyTo: \"**/*.{ts,tsx}\"\n---\n\n# Example: scoped instructions (applyTo)\n\nThese instructions apply only to TypeScript files.\n\n- Prefer \`type\` imports for types (\`import type { ... }\`).\n- Avoid \`any\` unless you justify it.\n- Keep components server-first; add \"use client\" only when needed.\n- Add tests for new behavior when practical.\n`,
    },
  },
  "github-copilot": {
    root: {
      id: "github-copilot-root",
      label: "copilot-instructions.md (root)",
      path: ".github/copilot-instructions.md",
      content: `# Example: \`.github/copilot-instructions.md\`

Use this file to tell GitHub Copilot how to work in your repo.

## Working agreement
- Prefer small, reviewable diffs.
- Fix root causes; avoid band-aids.
- Run tests and linters before proposing changes.

## Project conventions
- Package manager: \`pnpm\`
- Tests: \`pnpm test\`
- Type-check: \`pnpm type-check\`
- Lint: \`pnpm lint\`

## Output style
- Be concise, direct, and actionable.
- When unsure, ask clarifying questions rather than guessing.
`,
    },
    scoped: {
      id: "github-copilot-scoped",
      label: "instructions (scoped)",
      path: ".github/instructions/app.instructions.md",
      content: `---\napplyTo: \"**/*.{ts,tsx}\"\n---\n\n# Example: scoped instructions (applyTo)\n\nThese instructions apply only to TypeScript files.\n\n- Prefer \`type\` imports for types (\`import type { ... }\`).\n- Avoid \`any\` unless you justify it.\n- Keep components server-first; add \"use client\" only when needed.\n- Add tests for new behavior when practical.\n`,
    },
  },
};
