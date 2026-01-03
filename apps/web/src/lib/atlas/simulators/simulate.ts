import type {
  LoadedFile,
  RepoTree,
  ShadowedFile,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
  SimulatorToolId,
} from './types.ts';
import { simulateClaudeCode } from './tools/claudeCode.ts';
import { simulateCopilotCli } from './tools/copilotCli.ts';
import { simulateCodexCli } from './tools/codexCli.ts';
import { simulateCursorRules } from './tools/cursorRules.ts';
import { simulateGeminiCli } from './tools/geminiCli.ts';
import { simulateGitHubCopilot } from './tools/githubCopilot.ts';

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

const TOOL_LABELS: Record<SimulatorToolId, string> = {
  'github-copilot': 'GitHub Copilot',
  'copilot-cli': 'Copilot CLI',
  'codex-cli': 'Codex CLI',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  cursor: 'Cursor',
};

function toolLabel(tool: SimulatorToolId): string {
  return TOOL_LABELS[tool] ?? tool;
}

function formatToolList(tools: SimulatorToolId[]): string {
  if (tools.length === 1) return toolLabel(tools[0]);
  if (tools.length === 2) return `${toolLabel(tools[0])} or ${toolLabel(tools[1])}`;
  const allButLast = tools.slice(0, -1).map((tool) => toolLabel(tool));
  const last = toolLabel(tools[tools.length - 1]);
  return `${allButLast.join(', ')}, or ${last}`;
}

function instructionOwners(path: string): SimulatorToolId[] {
  if (path === '.github/copilot-instructions.md') return ['github-copilot', 'copilot-cli'];
  if (path.startsWith('.github/instructions/') && path.endsWith('.instructions.md')) {
    return ['github-copilot'];
  }
  if (path.startsWith('.github/copilot-instructions/') && path.endsWith('.instructions.md')) {
    return ['copilot-cli'];
  }
  if (path.startsWith('.github/agents/')) return ['copilot-cli'];
  if (path === 'AGENTS.md' || path.endsWith('/AGENTS.md')) return ['codex-cli'];
  if (path === 'AGENTS.override.md' || path.endsWith('/AGENTS.override.md')) return ['codex-cli'];
  if (path === 'CLAUDE.md' || path.endsWith('/CLAUDE.md')) return ['claude-code'];
  if (path === 'GEMINI.md' || path.endsWith('/GEMINI.md')) return ['gemini-cli'];
  if (path.startsWith('.cursor/rules/') && path.endsWith('.mdc')) return ['cursor'];
  if (path === '.cursorrules') return ['cursor'];
  return [];
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

function isAncestorFile(path: string, cwd: string, fileName: string): boolean {
  const normalized = normalizePath(path);
  return ancestorDirs(cwd).some((dir) => joinDirFile(dir, fileName) === normalized);
}

function buildIndex(tree: RepoTree): TreeIndex {
  const paths = new Set<string>();
  const content = new Map<string, string>();

  for (const file of tree.files) {
    const normalized = normalizePath(file.path);
    if (!normalized) continue;
    paths.add(normalized);
    if (file.content) {
      content.set(normalized, file.content);
    }
  }

  return {
    has: (filePath: string) => paths.has(normalizePath(filePath)),
    listPaths: () => Array.from(paths).sort(),
    getContent: (filePath: string) => content.get(normalizePath(filePath)) ?? null,
  };
}

function dedupeLoaded(items: LoadedFile[]): LoadedFile[] {
  const seen = new Set<string>();
  const out: LoadedFile[] = [];
  for (const item of items) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    out.push(item);
  }
  return out;
}

function buildShadowedFiles({
  tool,
  cwd,
  tree,
  loaded,
}: {
  tool: SimulatorToolId;
  cwd: string;
  tree: TreeIndex;
  loaded: LoadedFile[];
}): ShadowedFile[] {
  const loadedPaths = new Set(loaded.map((item) => normalizePath(item.path)));
  const out: ShadowedFile[] = [];

  for (const rawPath of tree.listPaths()) {
    const path = normalizePath(rawPath);
    if (!path || loadedPaths.has(path)) continue;
    const owners = instructionOwners(path);
    if (owners.length === 0) continue;

    if (owners.includes(tool)) {
      if (tool === 'codex-cli') {
        const isAncestor =
          isAncestorFile(path, cwd, 'AGENTS.md') ||
          isAncestorFile(path, cwd, 'AGENTS.override.md');
        if (!isAncestor) {
          out.push({
            path,
            reason: 'Outside current directory; Codex CLI loads AGENTS.md files from repo root to cwd.',
          });
        }
        continue;
      }
      if (tool === 'claude-code') {
        if (!isAncestorFile(path, cwd, 'CLAUDE.md')) {
          out.push({
            path,
            reason: 'Outside current directory; Claude loads CLAUDE.md files from repo root to cwd.',
          });
        }
        continue;
      }
      if (tool === 'gemini-cli') {
        if (!isAncestorFile(path, cwd, 'GEMINI.md')) {
          out.push({
            path,
            reason: 'Outside current directory; Gemini loads GEMINI.md files from repo root to cwd.',
          });
        }
        continue;
      }

      out.push({
        path,
        reason: 'Ignored by current tool rules.',
      });
      continue;
    }

    out.push({
      path,
      reason: `Used by ${formatToolList(owners)}.`,
    });
  }

  return out;
}

function computeWarnings(tree: TreeIndex): SimulationWarning[] {
  const warnings: SimulationWarning[] = [];
  const paths = tree.listPaths();

  const total = paths.length;
  if (total > 25) {
    warnings.push({
      code: 'scan-risk.large-tree',
      message: `Tree contains ${total} files; downward scans may explode context.`,
    });
  }

  const cursorRules = paths.filter(path => path.startsWith('.cursor/rules/'));
  if (cursorRules.length > 10) {
    warnings.push({
      code: 'scan-risk.cursor-rules',
      message: `.cursor/rules contains ${cursorRules.length} files.`,
    });
  }
  if (cursorRules.length > 0 && paths.includes('.cursorrules')) {
    warnings.push({
      code: 'deprecated.cursorrules',
      message: 'Legacy .cursorrules found alongside .cursor/rules.',
    });
  }

  return warnings;
}

export function simulateContextResolution({ tool, tree, cwd }: SimulationInput): SimulationResult {
  const indexed = buildIndex(tree);
  const warnings = computeWarnings(indexed);

  const loaded = (() => {
    if (tool === 'github-copilot') return simulateGitHubCopilot(indexed);
    if (tool === 'copilot-cli') return simulateCopilotCli(indexed);
    if (tool === 'claude-code') return simulateClaudeCode(indexed, cwd);
    if (tool === 'gemini-cli') return simulateGeminiCli(indexed, cwd);
    if (tool === 'codex-cli') return simulateCodexCli(indexed, cwd);
    if (tool === 'cursor') return simulateCursorRules(indexed);
    return [];
  })();

  const dedupedLoaded = dedupeLoaded(loaded);
  const shadowed = buildShadowedFiles({ tool, cwd, tree: indexed, loaded: dedupedLoaded });

  return {
    loaded: dedupedLoaded,
    warnings,
    shadowed,
  };
}
