import type { UamCapabilityV1, UamTargetV1, UamV1 } from '@/lib/uam/uamTypes';

export type SkillExportConfig = {
  exportAll: boolean;
  allowList: string[] | null;
};

export type SkillExportSelection = {
  mode: 'off' | 'all' | 'allowlist';
  allowList: string[];
};

function normalizeAllowList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map(value => String(value).trim())
    .filter(Boolean);
}

export function parseSkillExportConfig(target?: Pick<UamTargetV1, 'options'>): SkillExportConfig {
  const options = (target?.options ?? {}) as Record<string, unknown>;
  const exportAll = options.exportSkills === true;

  const allowList = normalizeAllowList(options.skills) ?? normalizeAllowList(options.exportSkills);
  if (allowList !== null) {
    return { exportAll: false, allowList };
  }

  return { exportAll, allowList: null };
}

export function getSkillExportSelection(target?: Pick<UamTargetV1, 'options'>): SkillExportSelection {
  const config = parseSkillExportConfig(target);
  if (config.exportAll) return { mode: 'all', allowList: [] };
  if (config.allowList) return { mode: 'allowlist', allowList: config.allowList };
  return { mode: 'off', allowList: [] };
}

export function applySkillExportSelection(
  options: Record<string, unknown>,
  selection: SkillExportSelection
): Record<string, unknown> {
  const next = { ...options };
  delete next.exportSkills;
  delete next.skills;

  if (selection.mode === 'all') {
    next.exportSkills = true;
  } else if (selection.mode === 'allowlist') {
    next.skills = selection.allowList;
  }

  return next;
}

export function resolveSkillExport(
  uam: UamV1,
  config: SkillExportConfig
): { capabilities: UamCapabilityV1[]; warnings: string[] } {
  if (!config.exportAll && !config.allowList) return { capabilities: [], warnings: [] };

  const warnings: string[] = [];
  if (config.exportAll) return { capabilities: uam.capabilities, warnings };

  const requestedIds = config.allowList ?? [];
  const capabilityById = new Map(uam.capabilities.map(capability => [capability.id, capability] as const));
  const seen = new Set<string>();
  const capabilities: UamCapabilityV1[] = [];

  for (const id of requestedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const capability = capabilityById.get(id);
    if (!capability) {
      warnings.push(`Unknown skill capability id '${id}'. Skipped.`);
      continue;
    }
    capabilities.push(capability);
  }

  return { capabilities, warnings };
}

export function renderSkillMarkdown(capability: UamCapabilityV1): string {
  const title = capability.title?.trim();
  const heading = `# ${title && title.length > 0 ? title : capability.id}`;
  const desc = capability.description?.trim();
  const parts: string[] = [heading];
  if (desc && desc.length > 0) parts.push(desc);
  if (capability.params && Object.keys(capability.params).length > 0) {
    parts.push('```json\n' + JSON.stringify(capability.params, null, 2) + '\n```');
  }
  return parts.join('\n\n').trimEnd() + '\n';
}

export function renderSkillsInlineSection(
  capabilities: UamCapabilityV1[],
  heading: string = 'Skills'
): string {
  if (capabilities.length === 0) return '';
  const parts: string[] = [`## ${heading}`];

  for (const capability of capabilities) {
    const title = capability.title?.trim();
    parts.push(`### ${title && title.length > 0 ? title : capability.id}`);
    parts.push(`Id: ${capability.id}`);
    if (capability.description && capability.description.trim().length > 0) {
      parts.push(capability.description.trim());
    }
    if (capability.params && Object.keys(capability.params).length > 0) {
      parts.push('```json\n' + JSON.stringify(capability.params, null, 2) + '\n```');
    }
  }

  return parts.join('\n\n').trimEnd();
}
