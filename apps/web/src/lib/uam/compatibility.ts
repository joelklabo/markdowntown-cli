import type { UamScopeV1, UamTargetV1, UamV1 } from './uamTypes';

export type CompatibilitySupport = 'supported' | 'unsupported' | 'lossy' | 'unknown';
export type CompatibilityFeatureId = 'global-scope' | 'dir-scope' | 'glob-scope' | 'skills-export';

export type CompatibilityFeature = {
  id: CompatibilityFeatureId;
  label: string;
  description: string;
};

export type CompatibilityTarget = {
  targetId: string;
  label: string;
  support: Record<CompatibilityFeatureId, CompatibilitySupport>;
};

export type CompatibilityWarning = {
  targetId: string;
  featureId: CompatibilityFeatureId;
  message: string;
};

export type CompatibilityMatrix = {
  features: CompatibilityFeature[];
  targets: CompatibilityTarget[];
  warnings: CompatibilityWarning[];
};

const FEATURES: CompatibilityFeature[] = [
  {
    id: 'global-scope',
    label: 'Global scope',
    description: 'One shared instruction file for the whole repo.',
  },
  {
    id: 'dir-scope',
    label: 'Directory scopes',
    description: 'Folder-specific instructions.',
  },
  {
    id: 'glob-scope',
    label: 'Glob scopes',
    description: 'Pattern-based instructions (applyTo/globs).',
  },
  {
    id: 'skills-export',
    label: 'Skills export',
    description: 'Export skills alongside instructions.',
  },
];

const TARGET_LABELS = new Map<string, string>([
  ['agents-md', 'AGENTS.md'],
  ['github-copilot', 'GitHub Copilot'],
  ['claude-code', 'Claude Code'],
  ['gemini-cli', 'Gemini CLI'],
]);

const TARGET_ORDER = ['agents-md', 'github-copilot', 'claude-code', 'gemini-cli'];

const TARGET_SUPPORT: Record<string, Record<CompatibilityFeatureId, CompatibilitySupport>> = {
  'agents-md': {
    'global-scope': 'supported',
    'dir-scope': 'supported',
    'glob-scope': 'unsupported',
    'skills-export': 'supported',
  },
  'github-copilot': {
    'global-scope': 'supported',
    'dir-scope': 'unsupported',
    'glob-scope': 'supported',
    'skills-export': 'supported',
  },
  'claude-code': {
    'global-scope': 'supported',
    'dir-scope': 'supported',
    'glob-scope': 'supported',
    'skills-export': 'supported',
  },
  'gemini-cli': {
    'global-scope': 'supported',
    'dir-scope': 'lossy',
    'glob-scope': 'lossy',
    'skills-export': 'unsupported',
  },
};

const EMPTY_SUPPORT: Record<CompatibilityFeatureId, CompatibilitySupport> = {
  'global-scope': 'unknown',
  'dir-scope': 'unknown',
  'glob-scope': 'unknown',
  'skills-export': 'unknown',
};

function targetLabel(targetId: string): string {
  return TARGET_LABELS.get(targetId) ?? targetId;
}

function supportForTarget(targetId: string): Record<CompatibilityFeatureId, CompatibilitySupport> {
  return TARGET_SUPPORT[targetId] ?? EMPTY_SUPPORT;
}

function countBlocksByScopeKind(uam: UamV1): Record<UamScopeV1['kind'], number> {
  const counts: Record<UamScopeV1['kind'], number> = {
    global: 0,
    dir: 0,
    glob: 0,
  };
  const scopeById = new Map(uam.scopes.map((scope) => [scope.id, scope] as const));

  for (const block of uam.blocks) {
    const scope = scopeById.get(block.scopeId);
    if (!scope) continue;
    counts[scope.kind] += 1;
  }

  return counts;
}

function scopeKindLabel(kind: UamScopeV1['kind']): string {
  if (kind === 'dir') return 'directory';
  if (kind === 'glob') return 'glob';
  return 'global';
}

function countLabel(count: number): string {
  return `${count} block${count === 1 ? '' : 's'}`;
}

export function buildCompatibilityMatrix(uam: UamV1, targets: UamTargetV1[]): CompatibilityMatrix {
  const scopedCounts = countBlocksByScopeKind(uam);
  const capabilityCount = uam.capabilities.length;

  const orderedTargets = [...targets].sort((a, b) => {
    const aIndex = TARGET_ORDER.indexOf(a.targetId);
    const bIndex = TARGET_ORDER.indexOf(b.targetId);
    const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return a.targetId.localeCompare(b.targetId);
  });

  const targetSummaries: CompatibilityTarget[] = orderedTargets.map((target) => ({
    targetId: target.targetId,
    label: targetLabel(target.targetId),
    support: supportForTarget(target.targetId),
  }));

  const warnings: CompatibilityWarning[] = [];

  for (const target of targetSummaries) {
    const support = target.support;

    if (scopedCounts.dir > 0) {
      const status = support['dir-scope'];
      if (status === 'unsupported') {
        warnings.push({
          targetId: target.targetId,
          featureId: 'dir-scope',
          message: `${target.label} does not support directory scopes; ${countLabel(scopedCounts.dir)} will be skipped.`,
        });
      }
      if (status === 'lossy') {
        warnings.push({
          targetId: target.targetId,
          featureId: 'dir-scope',
          message: `${target.label} treats directory scopes as global (lossy); ${countLabel(scopedCounts.dir)} will apply globally.`,
        });
      }
    }

    if (scopedCounts.glob > 0) {
      const status = support['glob-scope'];
      if (status === 'unsupported') {
        warnings.push({
          targetId: target.targetId,
          featureId: 'glob-scope',
          message: `${target.label} does not support glob scopes; ${countLabel(scopedCounts.glob)} will be skipped.`,
        });
      }
      if (status === 'lossy') {
        warnings.push({
          targetId: target.targetId,
          featureId: 'glob-scope',
          message: `${target.label} treats glob scopes as global (lossy); ${countLabel(scopedCounts.glob)} will apply globally.`,
        });
      }
    }

    if (capabilityCount > 0 && support['skills-export'] === 'unsupported') {
      warnings.push({
        targetId: target.targetId,
        featureId: 'skills-export',
        message: `${target.label} does not export skills; ${capabilityCount} skill${capabilityCount === 1 ? '' : 's'} will be omitted.`,
      });
    }

    if (support['global-scope'] === 'unsupported' && scopedCounts.global > 0) {
      warnings.push({
        targetId: target.targetId,
        featureId: 'global-scope',
        message: `${target.label} does not support ${scopeKindLabel('global')} scope.`,
      });
    }
  }

  return {
    features: FEATURES,
    targets: targetSummaries,
    warnings,
  };
}
