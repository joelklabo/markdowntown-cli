export const UAM_V1_SCHEMA_VERSION = 1 as const;
export const DEFAULT_ADAPTER_VERSION = '1' as const;
export const GLOBAL_SCOPE_ID = 'global' as const;

export type UamV1SchemaVersion = typeof UAM_V1_SCHEMA_VERSION;

export interface UamMetaV1 {
  title: string;
  description?: string;
}

export type UamScopeKindV1 = 'global' | 'dir' | 'glob';

export interface UamGlobalScopeV1 {
  id: string;
  kind: 'global';
  name?: string;
}

export interface UamDirScopeV1 {
  id: string;
  kind: 'dir';
  dir: string;
  name?: string;
}

export interface UamGlobScopeV1 {
  id: string;
  kind: 'glob';
  patterns: string[];
  name?: string;
}

export type UamScopeV1 = UamGlobalScopeV1 | UamDirScopeV1 | UamGlobScopeV1;

export type UamBlockKindV1 = 'markdown' | 'checklist' | 'commands' | 'dos-donts' | 'files';

export interface UamBlockV1 {
  id: string;
  scopeId: string;
  kind: UamBlockKindV1;
  title?: string;
  body: string;
}

export type StructuredBlockDefaults = {
  title?: string;
  body: string;
};

export function getStructuredBlockDefaults(kind: UamBlockKindV1): StructuredBlockDefaults {
  switch (kind) {
    case 'checklist':
      return { body: '- [ ] Add item\n- [ ] Add item\n' };
    case 'commands':
      return { body: '```bash\n# Add command\n```\n' };
    case 'dos-donts':
      return { body: "## Do\n- \n\n## Don't\n- \n" };
    case 'files':
      return { body: '- `src/...`\n- `__tests__/...`\n' };
    default:
      return { body: '' };
  }
}

export interface UamCapabilityV1 {
  id: string;
  title?: string;
  description?: string;
  params?: Record<string, unknown>;
}

export interface UamTargetV1 {
  targetId: string;
  adapterVersion: string;
  options: Record<string, unknown>;
}

export interface UamV1 {
  schemaVersion: UamV1SchemaVersion;
  meta: UamMetaV1;
  scopes: UamScopeV1[];
  blocks: UamBlockV1[];
  capabilities: UamCapabilityV1[];
  targets: UamTargetV1[];
}

export function createUamTargetV1(
  targetId: string,
  overrides?: Partial<Omit<UamTargetV1, 'targetId'>>
): UamTargetV1 {
  return {
    targetId,
    adapterVersion: overrides?.adapterVersion ?? DEFAULT_ADAPTER_VERSION,
    options: overrides?.options ?? {},
  };
}

export function normalizeUamTargetsV1(
  targets?: Array<Pick<UamTargetV1, 'targetId'> & Partial<Omit<UamTargetV1, 'targetId'>>>
): UamTargetV1[] {
  return (targets ?? []).map(t =>
    createUamTargetV1(t.targetId, { adapterVersion: t.adapterVersion, options: t.options })
  );
}

export function createEmptyUamV1(meta?: Partial<UamMetaV1>): UamV1 {
  return {
    schemaVersion: UAM_V1_SCHEMA_VERSION,
    meta: {
      title: meta?.title ?? 'Untitled',
      ...(meta?.description ? { description: meta.description } : {}),
    },
    scopes: [{ id: GLOBAL_SCOPE_ID, kind: 'global', name: 'Global' }],
    blocks: [],
    capabilities: [],
    targets: [],
  };
}

export function wrapMarkdownAsGlobal(markdown: string, meta?: Partial<UamMetaV1>): UamV1 {
  const uam = createEmptyUamV1(meta);
  return {
    ...uam,
    blocks: [
      {
        id: 'block-1',
        scopeId: GLOBAL_SCOPE_ID,
        kind: 'markdown',
        body: markdown,
      },
    ],
  };
}
