import type { InstructionDiagnostic, InstructionDiagnostics, RepoTree, SimulatorToolId } from './types';
import { resolveClaudeImports } from './claudeImports';

type DiagnosticsInput = {
  tool: SimulatorToolId;
  tree: RepoTree;
  cwd?: string;
};

type TreeIndex = {
  has: (filePath: string) => boolean;
  listPaths: () => string[];
  getContent: (filePath: string) => string | null;
};

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return '';
  return normalized;
}

function buildIndex(tree: RepoTree): TreeIndex {
  const paths = new Set<string>();
  const contents = new Map<string, string>();
  for (const file of tree.files) {
    const normalized = normalizePath(file.path);
    if (!normalized) continue;
    paths.add(normalized);
    if (file.content) {
      contents.set(normalized, file.content);
    }
  }
  return {
    has: (filePath: string) => paths.has(normalizePath(filePath)),
    listPaths: () => Array.from(paths).sort(),
    getContent: (filePath: string) => contents.get(normalizePath(filePath)) ?? null,
  };
}

function ancestorDirs(cwd: string): string[] {
  const normalized = normalizePath(cwd);
  const parts = normalized ? normalized.split('/') : [];
  const dirs: string[] = [''];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    dirs.push(current);
  }
  return dirs;
}

function joinDirFile(dir: string, fileName: string): string {
  return dir ? `${dir}/${fileName}` : fileName;
}

function dirName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function findCaseMismatchForFile(paths: string[], fileName: string): string | null {
  const needle = fileName.toLowerCase();
  for (const path of paths) {
    const lower = path.toLowerCase();
    const matches = lower === needle || lower.endsWith(`/${needle}`);
    if (!matches) continue;
    if (path === fileName || path.endsWith(`/${fileName}`)) return null;
    return path;
  }
  return null;
}

function addDiagnostic(list: InstructionDiagnostic[], diag: InstructionDiagnostic) {
  list.push(diag);
}

export function computeInstructionDiagnostics({ tool, tree, cwd = '' }: DiagnosticsInput): InstructionDiagnostics {
  const index = buildIndex(tree);
  const paths = index.listPaths();
  const diagnostics: InstructionDiagnostic[] = [];

  const agentsFiles = paths.filter((path) => path === 'AGENTS.md' || path.endsWith('/AGENTS.md'));
  const agentsOverride = paths.filter((path) => path === 'AGENTS.override.md' || path.endsWith('/AGENTS.override.md'));
  const claudeFiles = paths.filter((path) => path === 'CLAUDE.md' || path.endsWith('/CLAUDE.md'));
  const geminiFiles = paths.filter((path) => path === 'GEMINI.md' || path.endsWith('/GEMINI.md'));
  const cursorRuleFiles = paths.filter((path) => path.startsWith('.cursor/rules/'));
  const cursorLegacyFiles = paths.filter((path) => path === '.cursorrules');

  const copilotCliRoot = index.has('.github/copilot-instructions.md');
  const copilotCliScoped = paths.some(
    (path) => path.startsWith('.github/copilot-instructions/') && path.endsWith('.instructions.md'),
  );
  const copilotCliAgents = paths.some((path) => path.startsWith('.github/agents/'));
  const copilotCliWrongExtension = paths.filter(
    (path) =>
      path.startsWith('.github/copilot-instructions/') &&
      !path.endsWith('.instructions.md') &&
      path !== '.github/copilot-instructions.md',
  );

  const githubCopilotScoped = paths.some(
    (path) => path.startsWith('.github/instructions/') && path.endsWith('.instructions.md'),
  );

  const normalizedCwd = normalizePath(cwd);

  const caseMismatchAgents = findCaseMismatchForFile(paths, 'AGENTS.md');
  if (caseMismatchAgents) {
    addDiagnostic(diagnostics, {
      code: 'case-mismatch.agents',
      severity: 'error',
      message: `Found '${caseMismatchAgents}' but Codex CLI expects 'AGENTS.md'.`,
      suggestion: 'Rename the file to AGENTS.md (uppercase).',
      path: caseMismatchAgents,
      expectedPath: 'AGENTS.md',
    });
  }

  const caseMismatchOverride = findCaseMismatchForFile(paths, 'AGENTS.override.md');
  if (caseMismatchOverride) {
    addDiagnostic(diagnostics, {
      code: 'case-mismatch.override',
      severity: 'error',
      message: `Found '${caseMismatchOverride}' but Codex CLI expects 'AGENTS.override.md'.`,
      suggestion: 'Rename the file to AGENTS.override.md.',
      path: caseMismatchOverride,
      expectedPath: 'AGENTS.override.md',
    });
  }

  const caseMismatchClaude = findCaseMismatchForFile(paths, 'CLAUDE.md');
  if (caseMismatchClaude) {
    addDiagnostic(diagnostics, {
      code: 'case-mismatch.claude',
      severity: 'error',
      message: `Found '${caseMismatchClaude}' but Claude Code expects 'CLAUDE.md'.`,
      suggestion: 'Rename the file to CLAUDE.md (uppercase).',
      path: caseMismatchClaude,
      expectedPath: 'CLAUDE.md',
    });
  }

  const caseMismatchGemini = findCaseMismatchForFile(paths, 'GEMINI.md');
  if (caseMismatchGemini) {
    addDiagnostic(diagnostics, {
      code: 'case-mismatch.gemini',
      severity: 'error',
      message: `Found '${caseMismatchGemini}' but Gemini CLI expects 'GEMINI.md'.`,
      suggestion: 'Rename the file to GEMINI.md (uppercase).',
      path: caseMismatchGemini,
      expectedPath: 'GEMINI.md',
    });
  }

  const caseMismatchCopilotRoot = paths.find(
    (path) => path.toLowerCase() === '.github/copilot-instructions.md' && path !== '.github/copilot-instructions.md',
  );
  if (caseMismatchCopilotRoot) {
    addDiagnostic(diagnostics, {
      code: 'case-mismatch.copilot-root',
      severity: 'error',
      message: `Found '${caseMismatchCopilotRoot}' but Copilot expects '.github/copilot-instructions.md'.`,
      suggestion: 'Rename the file to .github/copilot-instructions.md.',
      path: caseMismatchCopilotRoot,
      expectedPath: '.github/copilot-instructions.md',
    });
  }

  if (tool === 'codex-cli') {
    if (agentsFiles.length === 0) {
      addDiagnostic(diagnostics, {
        code: 'missing.agents',
        severity: 'error',
        message: 'No AGENTS.md files found. Codex CLI loads AGENTS.md from repo root and ancestor folders.',
        suggestion: 'Add AGENTS.md at the repo root.',
        expectedPath: 'AGENTS.md',
      });
    } else if (!index.has('AGENTS.md')) {
      addDiagnostic(diagnostics, {
        code: 'missing.agents-root',
        severity: 'warning',
        message: 'No AGENTS.md at the repo root. Only scoped instructions were found.',
        suggestion: 'Add AGENTS.md at the repo root for global instructions.',
        expectedPath: 'AGENTS.md',
      });
    }

    for (const overridePath of agentsOverride) {
      const dir = dirName(overridePath);
      const basePath = joinDirFile(dir, 'AGENTS.md');
      if (!index.has(basePath)) {
        addDiagnostic(diagnostics, {
          code: 'override-without-base',
          severity: 'warning',
          message: `Found ${overridePath} without a matching AGENTS.md in the same folder.`,
          suggestion: `Add ${basePath} so the override has a base file to replace.`,
          path: overridePath,
          expectedPath: basePath,
        });
      }
    }

    if (!normalizedCwd) {
      addDiagnostic(diagnostics, {
        code: 'missing-cwd',
        severity: 'warning',
        message: 'Current directory (cwd) is required for Codex CLI ancestor lookups.',
        suggestion: 'Set cwd to the directory where Codex CLI runs (e.g., src/app).',
      });
    } else {
      const dirs = ancestorDirs(normalizedCwd);
      const hasAncestorAgents = dirs.some((dir) => index.has(joinDirFile(dir, 'AGENTS.md')));
      if (!hasAncestorAgents) {
        addDiagnostic(diagnostics, {
          code: 'no-ancestor-instructions',
          severity: 'warning',
          message: 'No AGENTS.md files are in the cwd ancestry. Codex CLI may not load any instructions.',
          suggestion: 'Confirm cwd and place AGENTS.md in the repo root or a parent directory.',
        });
      }
    }
  }

  if (tool === 'claude-code') {
    if (claudeFiles.length === 0) {
      addDiagnostic(diagnostics, {
        code: 'missing.claude',
        severity: 'error',
        message: 'No CLAUDE.md files found. Claude Code reads CLAUDE.md from the repo root and parent folders.',
        suggestion: 'Add CLAUDE.md at the repo root.',
        expectedPath: 'CLAUDE.md',
      });
    } else if (!index.has('CLAUDE.md')) {
      addDiagnostic(diagnostics, {
        code: 'missing.claude-root',
        severity: 'warning',
        message: 'No CLAUDE.md at the repo root. Only scoped memory files were found.',
        suggestion: 'Add CLAUDE.md at the repo root for global memory.',
        expectedPath: 'CLAUDE.md',
      });
    }

    if (!normalizedCwd) {
      addDiagnostic(diagnostics, {
        code: 'missing-cwd',
        severity: 'warning',
        message: 'Current directory (cwd) is required for Claude Code ancestor lookups.',
        suggestion: 'Set cwd to the directory where Claude Code runs (e.g., src/app).',
      });
    } else {
      const dirs = ancestorDirs(normalizedCwd);
      const hasAncestorClaude = dirs.some((dir) => index.has(joinDirFile(dir, 'CLAUDE.md')));
      if (!hasAncestorClaude) {
        addDiagnostic(diagnostics, {
          code: 'no-ancestor-instructions',
          severity: 'warning',
          message: 'No CLAUDE.md files are in the cwd ancestry. Claude Code may not load any memory files.',
          suggestion: 'Confirm cwd and place CLAUDE.md in the repo root or a parent directory.',
        });
      }
    }

    const imports = resolveClaudeImports(index, claudeFiles);
    for (const issue of imports.issues) {
      if (issue.type === 'missing') {
        addDiagnostic(diagnostics, {
          code: 'claude-import.missing',
          severity: 'warning',
          message: `Claude import not found: ${issue.rawPath}.`,
          suggestion: 'Add the missing file or update the @path reference.',
          path: issue.sourcePath,
          expectedPath: issue.resolvedPath,
        });
      } else if (issue.type === 'outside-root') {
        addDiagnostic(diagnostics, {
          code: 'claude-import.outside-root',
          severity: 'error',
          message: `Claude import points outside the repo: ${issue.rawPath}.`,
          suggestion: 'Use a repo-relative path in @path imports.',
          path: issue.sourcePath,
          expectedPath: issue.resolvedPath,
        });
      } else if (issue.type === 'circular') {
        addDiagnostic(diagnostics, {
          code: 'claude-import.circular',
          severity: 'error',
          message: `Circular Claude import detected via ${issue.rawPath}.`,
          suggestion: 'Remove the cycle by flattening or removing one @path reference.',
          path: issue.sourcePath,
          expectedPath: issue.resolvedPath,
        });
      }
    }
  }

  if (tool === 'gemini-cli') {
    if (geminiFiles.length === 0) {
      addDiagnostic(diagnostics, {
        code: 'missing.gemini',
        severity: 'error',
        message: 'No GEMINI.md files found. Gemini CLI reads GEMINI.md from the repo root and parent folders.',
        suggestion: 'Add GEMINI.md at the repo root.',
        expectedPath: 'GEMINI.md',
      });
    } else if (!index.has('GEMINI.md')) {
      addDiagnostic(diagnostics, {
        code: 'missing.gemini-root',
        severity: 'warning',
        message: 'No GEMINI.md at the repo root. Only scoped files were found.',
        suggestion: 'Add GEMINI.md at the repo root for global instructions.',
        expectedPath: 'GEMINI.md',
      });
    }

    if (!normalizedCwd) {
      addDiagnostic(diagnostics, {
        code: 'missing-cwd',
        severity: 'warning',
        message: 'Current directory (cwd) is required for Gemini CLI ancestor lookups.',
        suggestion: 'Set cwd to the directory where Gemini CLI runs (e.g., src/app).',
      });
    } else {
      const dirs = ancestorDirs(normalizedCwd);
      const hasAncestorGemini = dirs.some((dir) => index.has(joinDirFile(dir, 'GEMINI.md')));
      if (!hasAncestorGemini) {
        addDiagnostic(diagnostics, {
          code: 'no-ancestor-instructions',
          severity: 'warning',
          message: 'No GEMINI.md files are in the cwd ancestry. Gemini CLI may not load any instructions.',
          suggestion: 'Confirm cwd and place GEMINI.md in the repo root or a parent directory.',
        });
      }
    }
  }

  if (tool === 'cursor') {
    if (cursorLegacyFiles.length > 0 && cursorRuleFiles.length > 0) {
      addDiagnostic(diagnostics, {
        code: 'deprecated.cursorrules',
        severity: 'warning',
        message: 'Legacy .cursorrules found alongside .cursor/rules.',
        suggestion: 'Move legacy rules into .cursor/rules and remove .cursorrules.',
        path: cursorLegacyFiles[0],
        expectedPath: '.cursor/rules/',
      });
    }
  }

  if (tool === 'copilot-cli') {
    if (!copilotCliRoot && !copilotCliScoped && !copilotCliAgents) {
      addDiagnostic(diagnostics, {
        code: 'missing.copilot-cli',
        severity: 'error',
        message: 'No Copilot CLI instruction files found.',
        suggestion: 'Add .github/copilot-instructions.md or scoped files under .github/copilot-instructions/.',
        expectedPath: '.github/copilot-instructions.md',
      });
    }

    if (githubCopilotScoped && !copilotCliScoped) {
      addDiagnostic(diagnostics, {
        code: 'wrong-folder.copilot-cli',
        severity: 'warning',
        message: 'Found .github/instructions/*.instructions.md, which Copilot CLI does not read.',
        suggestion: 'Move scoped instructions to .github/copilot-instructions/.',
      });
    }

    for (const path of copilotCliWrongExtension) {
      addDiagnostic(diagnostics, {
        code: 'wrong-extension.copilot-cli',
        severity: 'warning',
        message: `Scoped Copilot CLI instructions should end with .instructions.md (found ${path}).`,
        suggestion: 'Rename the file to use the .instructions.md suffix.',
        path,
      });
    }
  }

  if (tool === 'github-copilot') {
    if (!copilotCliRoot && !githubCopilotScoped) {
      addDiagnostic(diagnostics, {
        code: 'missing.github-copilot',
        severity: 'error',
        message: 'No GitHub Copilot instruction files found.',
        suggestion: 'Add .github/copilot-instructions.md or .github/instructions/*.instructions.md.',
        expectedPath: '.github/copilot-instructions.md',
      });
    }

    if (copilotCliScoped && !githubCopilotScoped) {
      addDiagnostic(diagnostics, {
        code: 'wrong-folder.github-copilot',
        severity: 'warning',
        message: 'Scoped files are under .github/copilot-instructions/, but GitHub Copilot expects .github/instructions/.',
        suggestion: 'Move scoped instructions to .github/instructions/.',
      });
    }
  }

  const hasCodex = agentsFiles.length > 0 || agentsOverride.length > 0;
  const hasClaude = claudeFiles.length > 0;
  const hasGemini = geminiFiles.length > 0;
  const hasCopilotCli = copilotCliScoped || copilotCliAgents;
  const hasGitHubCopilot = githubCopilotScoped;

  const otherTools: string[] = [];
  if (tool !== 'codex-cli' && hasCodex) otherTools.push('Codex CLI');
  if (tool !== 'claude-code' && hasClaude) otherTools.push('Claude Code');
  if (tool !== 'gemini-cli' && hasGemini) otherTools.push('Gemini CLI');
  if (tool !== 'copilot-cli' && hasCopilotCli) otherTools.push('Copilot CLI');
  if (tool !== 'github-copilot' && hasGitHubCopilot) otherTools.push('GitHub Copilot');

  if (otherTools.length > 0) {
    addDiagnostic(diagnostics, {
      code: 'mixed-tools',
      severity: 'warning',
      message: `Instruction files for other tools were detected: ${otherTools.join(', ')}.`,
      suggestion: 'Confirm you are validating the correct tool and file layout.',
    });
  }

  return { tool, diagnostics };
}
