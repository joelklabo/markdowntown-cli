import type { UamScopeV1, UamTargetV1, UamV1 } from './uamTypes';

export type UamLintCode =
  | 'missing-setup-command'
  | 'missing-test-command'
  | 'dangerous-command'
  | 'unsupported-scope'
  | 'lossy-scope'
  | 'large-block'
  | 'large-total'
  | 'duplicate-block';

export type UamLintFixStub = {
  id: string;
  label: string;
};

export type UamLintWarning = {
  code: UamLintCode;
  message: string;
  scopeId?: string;
  fix?: UamLintFixStub;
};

function normalizeDir(dir: string): string {
  const normalized = dir.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

function scopeLabel(scope: UamScopeV1): string {
  if (scope.kind === 'global') return 'Global';
  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return dir.length > 0 ? dir : 'root';
  }
  const patterns = scope.patterns.join(', ').trim();
  return patterns.length > 0 ? patterns : 'glob';
}

function allText(uam: UamV1): string {
  return uam.blocks.map(b => b.body).join('\n');
}

type TargetScopeSupport = {
  targetId: string;
  supports: Array<UamScopeV1['kind']>;
  lossy?: boolean;
};

const TARGET_SCOPE_SUPPORT: TargetScopeSupport[] = [
  { targetId: 'agents-md', supports: ['global', 'dir'] },
  { targetId: 'github-copilot', supports: ['global', 'glob'] },
  { targetId: 'gemini-cli', supports: ['global', 'dir', 'glob'], lossy: true },
  { targetId: 'claude-code', supports: ['global', 'dir', 'glob'] },
  { targetId: 'cursor-rules', supports: ['global', 'dir', 'glob'] },
  { targetId: 'windsurf-rules', supports: ['global', 'dir', 'glob'] },
];

function supportForTarget(target: UamTargetV1): TargetScopeSupport | undefined {
  return TARGET_SCOPE_SUPPORT.find(s => s.targetId === target.targetId);
}

function hasAnyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

function detectMissingSetupAndTestCommands(uam: UamV1): UamLintWarning[] {
  const text = allText(uam);

  const setupPatterns: RegExp[] = [
    /\bpnpm\s+install\b/i,
    /\bnpm\s+(?:ci|install)\b/i,
    /\byarn\s+install\b/i,
    /\bbun\s+install\b/i,
    /\bpip\s+install\b/i,
    /\bpoetry\s+install\b/i,
  ];

  const testPatterns: RegExp[] = [
    /\bpnpm\s+test\b/i,
    /\bnpm\s+test\b/i,
    /\byarn\s+test\b/i,
    /\bbun\s+test\b/i,
    /\bpytest\b/i,
    /\bgo\s+test\b/i,
    /\bcargo\s+test\b/i,
    /\bdotnet\s+test\b/i,
    /\bmvn\s+test\b/i,
    /\bgradle\s+test\b/i,
    /\bmake\s+test\b/i,
  ];

  const warnings: UamLintWarning[] = [];

  if (!hasAnyMatch(text, setupPatterns)) {
    warnings.push({
      code: 'missing-setup-command',
      message: 'No setup command detected (e.g. pnpm install).',
      fix: { id: 'add-setup-commands', label: 'Add setup commands (stub)' },
    });
  }

  if (!hasAnyMatch(text, testPatterns)) {
    warnings.push({
      code: 'missing-test-command',
      message: 'No test command detected (e.g. pnpm test).',
      fix: { id: 'add-test-commands', label: 'Add test commands (stub)' },
    });
  }

  return warnings;
}

function detectDangerousCommands(uam: UamV1): UamLintWarning[] {
  const dangerousPatterns: Array<{ id: string; label: string; re: RegExp }> = [
    { id: 'rm-rf', label: 'rm -rf', re: /\brm\s+-rf\b/i },
    { id: 'sudo', label: 'sudo/doas', re: /\b(?:sudo|doas)\b/i },
    { id: 'curl-pipe', label: 'curl | sh', re: /\bcurl\b[^\n|]*\|\s*(?:sh|bash|zsh)\b/i },
    { id: 'wget-pipe', label: 'wget | sh', re: /\bwget\b[^\n|]*\|\s*(?:sh|bash|zsh)\b/i },
    { id: 'force-push', label: 'git push --force', re: /\bgit\s+push\b[^\n]*--force\b/i },
  ];

  const warnings: UamLintWarning[] = [];

  for (const block of uam.blocks) {
    if (block.kind !== 'commands') continue;
    for (const pattern of dangerousPatterns) {
      if (!pattern.re.test(block.body)) continue;
      warnings.push({
        code: 'dangerous-command',
        message: `Dangerous command pattern detected: ${pattern.label}.`,
        scopeId: block.scopeId,
        fix: { id: `review-dangerous-${pattern.id}`, label: 'Review/replace command (stub)' },
      });
    }
  }

  return warnings;
}

function detectSizeWarnings(uam: UamV1): UamLintWarning[] {
  const warnings: UamLintWarning[] = [];

  const totalChars = uam.blocks.reduce((sum, b) => sum + b.body.length, 0);
  const MAX_TOTAL_CHARS = 20_000;
  const MAX_BLOCK_CHARS = 6_000;

  if (totalChars > MAX_TOTAL_CHARS) {
    warnings.push({
      code: 'large-total',
      message: `Total instruction size is large (${totalChars} chars). Consider splitting or trimming.`,
    });
  }

  for (const block of uam.blocks) {
    if (block.body.length <= MAX_BLOCK_CHARS) continue;
    warnings.push({
      code: 'large-block',
      scopeId: block.scopeId,
      message: `Block '${block.id}' is large (${block.body.length} chars). Consider splitting.`,
    });
  }

  return warnings;
}

function detectDuplicateBlocks(uam: UamV1): UamLintWarning[] {
  const warnings: UamLintWarning[] = [];
  const seenByScope = new Map<string, Map<string, string>>();

  for (const block of uam.blocks) {
    const normalized = block.body.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) continue;
    const key = `${block.kind}:${normalized}`;
    const byKey = seenByScope.get(block.scopeId) ?? new Map<string, string>();
    const existingId = byKey.get(key);
    if (existingId) {
      warnings.push({
        code: 'duplicate-block',
        scopeId: block.scopeId,
        message: `Block '${block.id}' duplicates '${existingId}'.`,
      });
    } else {
      byKey.set(key, block.id);
      seenByScope.set(block.scopeId, byKey);
    }
  }

  return warnings;
}

function detectTargetScopeMismatches(uam: UamV1): UamLintWarning[] {
  const warnings: UamLintWarning[] = [];
  const scopeById = new Map(uam.scopes.map(s => [s.id, s] as const));

  const blocksByScopeId = new Map<string, number>();
  for (const block of uam.blocks) {
    blocksByScopeId.set(block.scopeId, (blocksByScopeId.get(block.scopeId) ?? 0) + 1);
  }

  const scopesWithBlocks = Array.from(blocksByScopeId.keys())
    .map(scopeId => scopeById.get(scopeId))
    .filter((s): s is UamScopeV1 => Boolean(s))
    .sort((a, b) => scopeLabel(a).localeCompare(scopeLabel(b)) || a.id.localeCompare(b.id));

  for (const target of uam.targets) {
    const support = supportForTarget(target);
    if (!support) continue;

    for (const scope of scopesWithBlocks) {
      if (support.supports.includes(scope.kind)) {
        if (support.lossy && scope.kind !== 'global') {
          warnings.push({
            code: 'lossy-scope',
            scopeId: scope.id,
            message: `Target '${support.targetId}' cannot enforce scoped rules for '${scopeLabel(scope)}' (lossy).`,
          });
        }
        continue;
      }

      warnings.push({
        code: 'unsupported-scope',
        scopeId: scope.id,
        message: `Target '${support.targetId}' does not support ${scope.kind} scope '${scopeLabel(scope)}'.`,
      });
    }
  }

  return warnings;
}

export function lintUamV1(uam: UamV1): UamLintWarning[] {
  const warnings: UamLintWarning[] = [
    ...detectMissingSetupAndTestCommands(uam),
    ...detectDangerousCommands(uam),
    ...detectTargetScopeMismatches(uam),
    ...detectSizeWarnings(uam),
    ...detectDuplicateBlocks(uam),
  ];

  warnings.sort((a, b) => {
    const scopeA = a.scopeId ?? '';
    const scopeB = b.scopeId ?? '';
    return scopeA.localeCompare(scopeB) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message);
  });

  return warnings;
}

