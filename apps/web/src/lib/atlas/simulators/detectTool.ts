import type {
  SimulatorToolId,
  ToolDetectionCandidate,
  ToolDetectionConfidence,
  ToolDetectionResult,
} from './types';

type MatchBucket = {
  paths: string[];
  reasonParts: string[];
  score: number;
};

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (!normalized || normalized === '.') return '';
  return normalized;
}

function isNamedFile(path: string, fileName: string): boolean {
  return path === fileName || path.endsWith(`/${fileName}`);
}

function collectMatches(paths: string[]): Record<SimulatorToolId, MatchBucket> {
  const buckets: Record<SimulatorToolId, MatchBucket> = {
    'codex-cli': { paths: [], reasonParts: [], score: 0 },
    'claude-code': { paths: [], reasonParts: [], score: 0 },
    'gemini-cli': { paths: [], reasonParts: [], score: 0 },
    'copilot-cli': { paths: [], reasonParts: [], score: 0 },
    'github-copilot': { paths: [], reasonParts: [], score: 0 },
    cursor: { paths: [], reasonParts: [], score: 0 },
  };

  const normalizedPaths = paths.map(normalizePath).filter(Boolean);
  const pathSet = new Set(normalizedPaths);

  const agents = normalizedPaths.filter((path) => isNamedFile(path, 'AGENTS.md'));
  const agentsOverride = normalizedPaths.filter((path) => isNamedFile(path, 'AGENTS.override.md'));
  const claude = normalizedPaths.filter((path) => isNamedFile(path, 'CLAUDE.md'));
  const gemini = normalizedPaths.filter((path) => isNamedFile(path, 'GEMINI.md'));
  const cursorRules = normalizedPaths.filter((path) => path.startsWith('.cursor/rules/'));
  const cursorLegacy = normalizedPaths.filter((path) => isNamedFile(path, '.cursorrules'));

  const copilotRoot = pathSet.has('.github/copilot-instructions.md')
    ? ['.github/copilot-instructions.md']
    : [];
  const copilotCliScoped = normalizedPaths.filter(
    (path) => path.startsWith('.github/copilot-instructions/') && path.endsWith('.instructions.md'),
  );
  const copilotCliAgents = normalizedPaths.filter((path) => path.startsWith('.github/agents/'));
  const githubCopilotScoped = normalizedPaths.filter(
    (path) => path.startsWith('.github/instructions/') && path.endsWith('.instructions.md'),
  );

  if (agents.length) {
    buckets['codex-cli'].paths.push(...agents);
    buckets['codex-cli'].score += agents.length * 3;
    buckets['codex-cli'].reasonParts.push('AGENTS.md');
  }
  if (agentsOverride.length) {
    buckets['codex-cli'].paths.push(...agentsOverride);
    buckets['codex-cli'].score += agentsOverride.length * 2;
    buckets['codex-cli'].reasonParts.push('AGENTS.override.md');
  }

  if (claude.length) {
    buckets['claude-code'].paths.push(...claude);
    buckets['claude-code'].score += claude.length * 3;
    buckets['claude-code'].reasonParts.push('CLAUDE.md');
  }

  if (gemini.length) {
    buckets['gemini-cli'].paths.push(...gemini);
    buckets['gemini-cli'].score += gemini.length * 3;
    buckets['gemini-cli'].reasonParts.push('GEMINI.md');
  }

  if (copilotRoot.length) {
    buckets['copilot-cli'].paths.push(...copilotRoot);
    buckets['copilot-cli'].score += 2;
    buckets['copilot-cli'].reasonParts.push('.github/copilot-instructions.md');

    buckets['github-copilot'].paths.push(...copilotRoot);
    buckets['github-copilot'].score += 2;
    buckets['github-copilot'].reasonParts.push('.github/copilot-instructions.md');
  }

  if (copilotCliScoped.length) {
    buckets['copilot-cli'].paths.push(...copilotCliScoped);
    buckets['copilot-cli'].score += copilotCliScoped.length * 2;
    buckets['copilot-cli'].reasonParts.push('.github/copilot-instructions/*.instructions.md');
  }

  if (copilotCliAgents.length) {
    buckets['copilot-cli'].paths.push(...copilotCliAgents);
    buckets['copilot-cli'].score += copilotCliAgents.length * 3;
    buckets['copilot-cli'].reasonParts.push('.github/agents/*');
  }

  if (githubCopilotScoped.length) {
    buckets['github-copilot'].paths.push(...githubCopilotScoped);
    buckets['github-copilot'].score += githubCopilotScoped.length * 3;
    buckets['github-copilot'].reasonParts.push('.github/instructions/*.instructions.md');
  }

  if (cursorRules.length) {
    buckets.cursor.paths.push(...cursorRules);
    buckets.cursor.score += cursorRules.length * 3;
    buckets.cursor.reasonParts.push('.cursor/rules/*');
  }

  if (cursorLegacy.length) {
    buckets.cursor.paths.push(...cursorLegacy);
    buckets.cursor.score += cursorLegacy.length * 3;
    buckets.cursor.reasonParts.push('.cursorrules');
  }

  return buckets;
}

function toCandidate(tool: SimulatorToolId, bucket: MatchBucket): ToolDetectionCandidate | null {
  if (bucket.score <= 0) return null;
  const uniquePaths = Array.from(new Set(bucket.paths)).sort();
  const reason = bucket.reasonParts.length
    ? `Matched ${Array.from(new Set(bucket.reasonParts)).join(', ')}`
    : 'Matched known instruction files.';
  return {
    tool,
    score: bucket.score,
    paths: uniquePaths,
    reason,
  };
}

function confidenceFor(score: number): ToolDetectionConfidence {
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  if (score >= 1) return 'low';
  return 'none';
}

export function detectTool(paths: string[]): ToolDetectionResult {
  const buckets = collectMatches(paths);
  const candidates = (Object.keys(buckets) as SimulatorToolId[])
    .map((tool) => toCandidate(tool, buckets[tool]))
    .filter((candidate): candidate is ToolDetectionCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      tool: null,
      confidence: 'none',
      candidates: [],
      matchedTools: [],
      isMixed: false,
    };
  }

  const topScore = candidates[0].score;
  const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
  const isMixed = candidates.length > 1;
  const matchedTools = candidates.map((candidate) => candidate.tool);

  if (topCandidates.length > 1) {
    return {
      tool: null,
      confidence: 'low',
      candidates,
      matchedTools,
      isMixed: true,
    };
  }

  const top = topCandidates[0];
  let confidence = confidenceFor(top.score);
  if (isMixed && confidence === 'high') {
    confidence = 'medium';
  }

  return {
    tool: top.tool,
    confidence,
    candidates,
    matchedTools,
    isMixed,
  };
}
