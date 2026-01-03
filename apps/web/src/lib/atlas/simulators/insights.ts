import type {
  RepoTree,
  SimulationInput,
  SimulatorInsightPattern,
  SimulatorInsights,
  SimulatorToolId,
} from './types.ts';

type TreeIndex = {
  has: (filePath: string) => boolean;
  listPaths: () => string[];
};

type PatternDefinition = SimulatorInsightPattern & {
  match: (index: TreeIndex, paths: string[]) => string[];
};

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return '';
  return normalized;
}

function buildIndex(tree: RepoTree): TreeIndex {
  const paths = new Set<string>();

  for (const file of tree.files) {
    const normalized = normalizePath(file.path);
    if (!normalized) continue;
    paths.add(normalized);
  }

  return {
    has: (filePath: string) => paths.has(normalizePath(filePath)),
    listPaths: () => Array.from(paths).sort(),
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

function uniqueOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

type InsightsSummary = {
  title: string;
  body: string;
  nextStep: string;
  note?: string;
};

const TOOL_LABELS: Record<SimulatorToolId, string> = {
  "github-copilot": "GitHub Copilot",
  "copilot-cli": "Copilot CLI",
  "codex-cli": "Codex CLI",
  "claude-code": "Claude Code",
  "gemini-cli": "Gemini CLI",
  cursor: "Cursor",
};

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function formatInsightsSummary(insights: SimulatorInsights, shadowedCount: number): InsightsSummary {
  const toolLabel = TOOL_LABELS[insights.tool] ?? insights.tool;
  const foundCount = insights.foundFiles.length;
  const missingCount = insights.missingFiles.length;
  const expectedCount = insights.expectedPatterns.length;

  const bodyParts: string[] = [];
  if (foundCount === 0) {
    bodyParts.push("No instruction files found.");
  } else {
    bodyParts.push(`Found ${formatCount(foundCount, "instruction file")}.`);
  }

  if (expectedCount > 0) {
    if (missingCount === 0) {
      bodyParts.push("All expected files are present.");
    } else {
      bodyParts.push(`${formatCount(missingCount, "expected file")} missing.`);
    }
  }

  if (shadowedCount > 0) {
    bodyParts.push(`${formatCount(shadowedCount, "shadowed instruction file")} won't load for this tool.`);
  }

  let nextStep = "";
  if (missingCount > 0) {
    nextStep = `Next step: add the missing instruction file${missingCount === 1 ? "" : "s"} or copy a template, then rescan.`;
  } else if (shadowedCount > 0) {
    nextStep = "Next step: switch tools or remove shadowed files to avoid conflicts.";
  } else if (foundCount === 0) {
    nextStep = "Next step: add a tool instruction file to get guidance, then rescan.";
  } else {
    nextStep = "Next step: open Workbench to build and export agents.md.";
  }

  const note =
    foundCount === 0 && expectedCount > 0
      ? "If your scan was truncated due to file limits, try scanning a smaller folder."
      : undefined;

  return {
    title: `Detected tool: ${toolLabel}`,
    body: bodyParts.join(" "),
    nextStep,
    note,
  };
}

function exactPattern(id: string, label: string, path: string): PatternDefinition {
  return {
    id,
    label,
    pattern: path,
    match: (index) => (index.has(path) ? [path] : []),
  };
}

function prefixPattern(
  id: string,
  label: string,
  pattern: string,
  prefix: string,
  suffix?: string,
): PatternDefinition {
  return {
    id,
    label,
    pattern,
    match: (_index, paths) =>
      paths.filter((path) => path.startsWith(prefix) && (!suffix || path.endsWith(suffix))),
  };
}

function buildResult(
  tool: SimulatorToolId,
  patterns: PatternDefinition[],
  precedenceNotes: string[],
  index: TreeIndex,
): SimulatorInsights {
  const paths = index.listPaths();
  const found: string[] = [];
  const missing: SimulatorInsightPattern[] = [];

  for (const pattern of patterns) {
    const matches = pattern.match(index, paths);
    if (matches.length === 0) {
      missing.push({ id: pattern.id, label: pattern.label, pattern: pattern.pattern });
      continue;
    }
    found.push(...matches);
  }

  return {
    tool,
    expectedPatterns: patterns.map(({ id, label, pattern }) => ({ id, label, pattern })),
    foundFiles: uniqueOrdered(found),
    missingFiles: missing,
    precedenceNotes,
  };
}

function gitHubCopilotInsights(index: TreeIndex): SimulatorInsights {
  const patterns = [
    exactPattern(
      'github-copilot.repo',
      'Repo instructions',
      '.github/copilot-instructions.md',
    ),
    prefixPattern(
      'github-copilot.scoped',
      'Scoped instructions',
      '.github/instructions/*.instructions.md',
      '.github/instructions/',
      '.instructions.md',
    ),
  ];

  return buildResult(
    'github-copilot',
    patterns,
    ['More specific scoped instructions take precedence over repo-wide instructions.'],
    index,
  );
}

function copilotCliInsights(index: TreeIndex): SimulatorInsights {
  const patterns = [
    exactPattern(
      'copilot-cli.repo',
      'Repo instructions',
      '.github/copilot-instructions.md',
    ),
    prefixPattern(
      'copilot-cli.scoped',
      'Scoped instructions',
      '.github/copilot-instructions/**/*.instructions.md',
      '.github/copilot-instructions/',
      '.instructions.md',
    ),
    prefixPattern(
      'copilot-cli.agents',
      'Agent profiles',
      '.github/agents/*',
      '.github/agents/',
    ),
  ];

  return buildResult(
    'copilot-cli',
    patterns,
    [
      'Scoped instruction files take precedence over repo-wide instructions.',
      'When agent profile names conflict, higher-precedence scopes win.',
    ],
    index,
  );
}

function codexCliInsights(index: TreeIndex, cwd: string): SimulatorInsights {
  const patterns: PatternDefinition[] = [];

  for (const dir of ancestorDirs(cwd)) {
    const labelSuffix = dir ? `(${dir})` : '(root)';
    patterns.push(
      exactPattern(
        `codex-cli.agents.${dir || 'root'}`,
        `Directory instructions ${labelSuffix}`,
        joinDirFile(dir, 'AGENTS.md'),
      ),
    );
    patterns.push(
      exactPattern(
        `codex-cli.override.${dir || 'root'}`,
        `Directory override ${labelSuffix}`,
        joinDirFile(dir, 'AGENTS.override.md'),
      ),
    );
  }

  return buildResult(
    'codex-cli',
    patterns,
    [
      'AGENTS.override.md overrides AGENTS.md in the same directory.',
      'Instructions accumulate from the repo root to the cwd; deeper directories take precedence.',
    ],
    index,
  );
}

function claudeCodeInsights(index: TreeIndex, cwd: string): SimulatorInsights {
  const patterns: PatternDefinition[] = [];

  for (const dir of ancestorDirs(cwd)) {
    const labelSuffix = dir ? `(${dir})` : '(root)';
    patterns.push(
      exactPattern(
        `claude-code.memory.${dir || 'root'}`,
        `Directory memory ${labelSuffix}`,
        joinDirFile(dir, 'CLAUDE.md'),
      ),
    );
  }

  return buildResult(
    'claude-code',
    patterns,
    ['More specific CLAUDE.md files (closer to the cwd) take precedence.'],
    index,
  );
}

function geminiCliInsights(index: TreeIndex, cwd: string): SimulatorInsights {
  const patterns: PatternDefinition[] = [];

  for (const dir of ancestorDirs(cwd)) {
    const labelSuffix = dir ? `(${dir})` : '(root)';
    patterns.push(
      exactPattern(
        `gemini-cli.memory.${dir || 'root'}`,
        `Directory memory ${labelSuffix}`,
        joinDirFile(dir, 'GEMINI.md'),
      ),
    );
  }

  return buildResult(
    'gemini-cli',
    patterns,
    ['More specific GEMINI.md files (closer to the cwd) take precedence.'],
    index,
  );
}

function cursorInsights(index: TreeIndex): SimulatorInsights {
  const patterns = [
    prefixPattern(
      'cursor.rules',
      'Cursor rule files',
      '.cursor/rules/*.mdc',
      '.cursor/rules/',
      '.mdc',
    ),
    exactPattern('cursor.legacy', 'Legacy .cursorrules', '.cursorrules'),
  ];

  return buildResult(
    'cursor',
    patterns,
    ['Rules in .cursor/rules take precedence over .cursorrules.'],
    index,
  );
}

export function computeSimulatorInsights({ tool, tree, cwd }: SimulationInput): SimulatorInsights {
  const index = buildIndex(tree);

  if (tool === 'github-copilot') {
    return gitHubCopilotInsights(index);
  }
  if (tool === 'copilot-cli') {
    return copilotCliInsights(index);
  }
  if (tool === 'codex-cli') {
    return codexCliInsights(index, cwd);
  }
  if (tool === 'claude-code') {
    return claudeCodeInsights(index, cwd);
  }
  if (tool === 'gemini-cli') {
    return geminiCliInsights(index, cwd);
  }
  if (tool === 'cursor') {
    return cursorInsights(index);
  }

  return buildResult(tool, [], [], index);
}
