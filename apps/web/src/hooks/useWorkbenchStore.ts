import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { CompilationResult } from '@/lib/uam/adapters';
import type { UAMBlock, UAMBlockType } from '@/lib/uam/types';
import type { SimulatorToolId } from '@/lib/atlas/simulators/types';
import { scanUamForSecrets } from '@/lib/secretScan';
import {
  createEmptyUamV1,
  createUamTargetV1,
  GLOBAL_SCOPE_ID,
  getStructuredBlockDefaults,
  normalizeUamTargetsV1,
  type UamBlockKindV1,
  type UamBlockV1,
  type UamCapabilityV1,
  type UamScopeV1,
  type UamTargetV1,
  type UamV1,
} from '@/lib/uam/uamTypes';
import { safeParseUamV1 } from '@/lib/uam/uamValidate';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type ArtifactVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
type ArtifactLoadResult =
  | { status: 'loaded'; title: string }
  | { status: 'error'; message: string };
type ScanContext = {
  tool: SimulatorToolId;
  cwd: string;
  paths: string[];
};
type SaveConflictDetails = {
  currentVersion?: string | null;
  updatedAt?: string | null;
  expectedVersion?: string | null;
  expectedUpdatedAt?: string | null;
};
type SaveConflict = {
  status: 'idle' | 'conflict';
  details?: SaveConflictDetails;
};
type SecretScanMatch = {
  label: string;
  redacted: string;
};
type SecretScanState = {
  status: 'idle' | 'blocked';
  matches: SecretScanMatch[];
  checkedAt?: number;
};

type BlockUpsertInput = Partial<UAMBlock> & {
  scopeId?: string;
  kind?: UamBlockKindV1;
  title?: string;
  body?: string;
};

type StructuredAssistScopeKind = 'current' | 'global' | 'dir' | 'glob';

type StructuredAssistInput = {
  scopeKind: StructuredAssistScopeKind;
  scopeValue?: string;
  scopeName?: string;
  blockKind: UamBlockKindV1;
  blockTitle?: string;
};

type WorkbenchScopeInput =
  | UamScopeV1
  | {
      id?: string;
      kind: UamScopeV1['kind'];
      name?: string;
      dir?: string;
      patterns?: string[];
    };

const inMemoryStorage = new Map<string, string>();

function safeLocalStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (typeof localStorage === 'undefined') return inMemoryStorage.get(name) ?? null;
      try {
        const value = localStorage.getItem(name);
        if (!value) return inMemoryStorage.get(name) ?? null;
        try {
          JSON.parse(value);
        } catch {
          localStorage.removeItem(name);
          inMemoryStorage.delete(name);
          return null;
        }
        return value;
      } catch {
        return inMemoryStorage.get(name) ?? null;
      }
    },
    setItem: (name, value) => {
      if (typeof localStorage === 'undefined') {
        inMemoryStorage.set(name, value);
        return;
      }
      try {
        localStorage.setItem(name, value);
        inMemoryStorage.delete(name);
      } catch {
        inMemoryStorage.set(name, value);
      }
    },
    removeItem: (name) => {
      inMemoryStorage.delete(name);
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore storage errors
      }
    },
  };
}

const WORKBENCH_STORAGE_KEY = 'workbench-storage';
const WORKBENCH_STORAGE_VERSION = 3;

const SCAN_CONTEXT_STORAGE_KEY = 'workbench-scan-context-v1';
const SCAN_CONTEXT_STORAGE_VERSION = 1;
const SCAN_CONTEXT_STORAGE_MAX_BYTES = 250_000;
const SCAN_CONTEXT_TRUNCATED_PATHS = 50;

type StoredScanContext = {
  version: number;
  storedAt: number;
  context: ScanContext;
};

function safeSessionStorage() {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

function isValidScanContext(value: unknown): value is ScanContext {
  if (!isRecord(value)) return false;
  if (typeof value.tool !== 'string') return false;
  if (!(value.tool in SCAN_TOOL_TARGET_MAP)) return false;
  if (typeof value.cwd !== 'string') return false;
  if (!Array.isArray(value.paths)) return false;
  return value.paths.every((entry) => typeof entry === 'string');
}

export function readStoredScanContext(): ScanContext | null {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SCAN_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredScanContext;
    if (!parsed || parsed.version !== SCAN_CONTEXT_STORAGE_VERSION) {
      clearStoredScanContext();
      return null;
    }
    if (!isValidScanContext(parsed.context)) {
      clearStoredScanContext();
      return null;
    }
    return parsed.context;
  } catch {
    clearStoredScanContext();
    return null;
  }
}

type PersistScanContextResult = {
  status: 'stored' | 'truncated' | 'failed';
  context: ScanContext;
  byteLength: number;
  originalPathCount: number;
};

function buildStoredScanContextPayload(context: ScanContext) {
  const payload: StoredScanContext = {
    version: SCAN_CONTEXT_STORAGE_VERSION,
    storedAt: Date.now(),
    context,
  };
  const json = JSON.stringify(payload);
  return { json, byteLength: getByteLength(json) };
}

export function persistScanContextForHandoff(
  rawContext: ScanContext,
  options?: { dryRun?: boolean },
): PersistScanContextResult {
  const storage = safeSessionStorage();
  if (!storage) {
    return {
      status: 'failed',
      context: rawContext,
      byteLength: 0,
      originalPathCount: rawContext.paths?.length ?? 0,
    };
  }

  const normalized: ScanContext = {
    tool: rawContext.tool,
    cwd: normalizeDirScope(rawContext.cwd ?? ''),
    paths: normalizeScanPaths(rawContext.paths ?? []),
  };
  const originalPathCount = normalized.paths.length;
  let candidate = normalized;
  let status: PersistScanContextResult['status'] = 'stored';
  let { json, byteLength } = buildStoredScanContextPayload(candidate);

  if (byteLength > SCAN_CONTEXT_STORAGE_MAX_BYTES) {
    const truncatedPaths = normalized.paths.slice(0, Math.min(SCAN_CONTEXT_TRUNCATED_PATHS, normalized.paths.length));
    candidate = { ...normalized, paths: truncatedPaths };
    status = 'truncated';
    ({ json, byteLength } = buildStoredScanContextPayload(candidate));
  }

  if (byteLength > SCAN_CONTEXT_STORAGE_MAX_BYTES) {
    candidate = { ...candidate, paths: [] };
    status = 'truncated';
    ({ json, byteLength } = buildStoredScanContextPayload(candidate));
  }

  if (options?.dryRun) {
    return { status, context: candidate, byteLength, originalPathCount };
  }

  try {
    storage.setItem(SCAN_CONTEXT_STORAGE_KEY, json);
    return { status, context: candidate, byteLength, originalPathCount };
  } catch {
    return { status: 'failed', context: candidate, byteLength, originalPathCount };
  }
}

function writeStoredScanContext(context: ScanContext) {
  persistScanContextForHandoff(context);
}

function clearStoredScanContext() {
  const storage = safeSessionStorage();
  if (!storage) return;
  storage.removeItem(SCAN_CONTEXT_STORAGE_KEY);
}

function hasMeaningfulDraft(uam: UamV1, persisted?: Partial<PersistedWorkbenchState>): boolean {
  const normalized = normalizeWorkbenchUam(uam);
  const title = normalized.meta.title?.trim() ?? '';
  const description = normalized.meta.description?.trim() ?? '';
  const hasMeta = (title.length > 0 && title !== 'Untitled Agent') || description.length > 0;
  const hasBlocks = normalized.blocks.length > 0;
  const hasCapabilities = normalized.capabilities.length > 0;
  const hasTargets = normalized.targets.length > 0;
  const hasScopes = normalized.scopes.length > 1;
  const hasVisibility = persisted?.visibility !== undefined && persisted.visibility !== 'PRIVATE';
  const hasTags = Array.isArray(persisted?.tags) && persisted.tags.length > 0;
  return hasMeta || hasBlocks || hasCapabilities || hasTargets || hasScopes || hasVisibility || hasTags;
}

type StoredDraftMeta = {
  hasDraft: boolean;
  lastSavedAt: number | null;
  hasArtifactId: boolean;
};

export function readStoredWorkbenchDraftMeta(): StoredDraftMeta | null {
  const storage = safeLocalStorage();
  const raw = storage.getItem(WORKBENCH_STORAGE_KEY);
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown };
    const state = (isRecord(parsed) && 'state' in parsed ? parsed.state : parsed) as unknown;
    if (!isRecord(state)) {
      storage.removeItem(WORKBENCH_STORAGE_KEY);
      return null;
    }
    const uam = (state as { uam?: unknown }).uam;
    const parsedUam = safeParseUamV1(uam);
    if (!parsedUam.success) {
      storage.removeItem(WORKBENCH_STORAGE_KEY);
      return null;
    }
    const persisted = state as PersistedWorkbenchState;
    const lastSavedAt = typeof persisted.lastSavedAt === 'number' ? persisted.lastSavedAt : null;
    const hasArtifactId = typeof persisted.id === 'string' && persisted.id.trim().length > 0;
    return {
      hasDraft: hasMeaningfulDraft(parsedUam.data, persisted),
      lastSavedAt,
      hasArtifactId,
    };
  } catch {
    storage.removeItem(WORKBENCH_STORAGE_KEY);
    return null;
  }
}

function clearStoredWorkbenchDraft() {
  const storage = safeLocalStorage();
  storage.removeItem(WORKBENCH_STORAGE_KEY);
}

function debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, delayMs: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delayMs);
  };
}

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}`;
}

function getByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeDirScope(dir: string): string {
  const normalized = dir.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

const MAX_SCAN_PATHS = 200;

function normalizeScanPath(path: string): string {
  return path.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function normalizeScanPaths(paths: string[]): string[] {
  const normalized = paths.map((path) => normalizeScanPath(String(path))).filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, MAX_SCAN_PATHS);
}

function legacyScopeLabel(scope: UamScopeV1): string {
  if (scope.kind === 'global') return 'root';
  if (scope.kind === 'dir') return normalizeDirScope(scope.dir);
  return scope.patterns[0] ?? 'root';
}

function syncUamTargetsFromLegacy(targetIds: string[]): UamTargetV1[] {
  return targetIds.map(targetId => createUamTargetV1(targetId));
}

function syncLegacyBlocksFromUam(blocks: UamBlockV1[]): UAMBlock[] {
  return blocks.map((b) => {
    const legacyType = (b as unknown as { type?: UAMBlockType }).type ?? 'instruction';
    const legacyContent = (b as unknown as { content?: string }).content ?? b.body;
    return {
      id: b.id,
      type: legacyType,
      content: legacyContent,
    };
  });
}

function syncUamBlocksFromLegacy(blocks: UAMBlock[], selectedScopeId: string): UamBlockV1[] {
  return blocks.map((b) => ({
    id: b.id,
    scopeId: selectedScopeId,
    kind: 'markdown',
    body: b.content,
    ...(b.type ? { type: b.type } : {}),
    ...(b.content ? { content: b.content } : {}),
  })) as unknown as UamBlockV1[];
}

function ensureGlobalScope(uam: UamV1): UamV1 {
  if (uam.scopes.some(s => s.id === GLOBAL_SCOPE_ID)) return uam;
  return {
    ...uam,
    scopes: [{ id: GLOBAL_SCOPE_ID, kind: 'global', name: 'Global' }, ...uam.scopes],
  };
}

function ensureSelectedScopeId(uam: UamV1, selectedScopeId: string | null | undefined): string {
  if (selectedScopeId && uam.scopes.some(s => s.id === selectedScopeId)) return selectedScopeId;
  return uam.scopes.some(s => s.id === GLOBAL_SCOPE_ID) ? GLOBAL_SCOPE_ID : (uam.scopes[0]?.id ?? GLOBAL_SCOPE_ID);
}

function ensureSelectedSkillId(uam: UamV1, selectedSkillId: string | null | undefined): string | null {
  if (selectedSkillId && uam.capabilities.some(c => c.id === selectedSkillId)) return selectedSkillId;
  return uam.capabilities[0]?.id ?? null;
}

function normalizeWorkbenchUam(uam: UamV1): UamV1 {
  const withGlobal = ensureGlobalScope(uam);
  return {
    ...withGlobal,
    meta: {
      title: withGlobal.meta.title ?? 'Untitled Agent',
      description: withGlobal.meta.description ?? '',
    },
    targets: normalizeUamTargetsV1(withGlobal.targets),
  };
}

type PersistedWorkbenchState = {
  id?: string;
  uam: UamV1;
  selectedScopeId?: string;
  selectedBlockId?: string | null;
  selectedSkillId?: string | null;
  visibility?: ArtifactVisibility;
  tags?: string[];
  lastSavedAt?: number | null;
};

interface WorkbenchState {
  id?: string;
  uam: UamV1;
  baselineUam: UamV1 | null;
  baselineVersion: string | null;
  baselineUpdatedAt: string | null;

  // Legacy/compat fields (kept in sync with `uam`)
  title: string;
  description: string;
  scopes: string[];
  blocks: UAMBlock[];
  targets: UamTargetV1[];
  skills: UamCapabilityV1[];

  // Selection
  selectedScopeId: string;
  selectedScope: string | null;
  selectedBlockId: string | null;
  selectedSkillId: string | null;

  visibility: ArtifactVisibility;
  tags: string[];

  compilationResult: CompilationResult | null;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: number | null;
  cloudSaveStatus: AutosaveStatus;
  cloudLastSavedAt: number | null;
  saveConflict: SaveConflict;
  secretScan: SecretScanState;
  secretScanAck: boolean;
  scanContext: ScanContext | null;

  // Actions
  setId: (id?: string) => void;
  setTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setVisibility: (visibility: ArtifactVisibility) => void;
  setTags: (tags: string[]) => void;

  setUam: (uam: UamV1) => void;

  addScope: (scope: WorkbenchScopeInput) => string;
  removeScope: (scopeId: string) => void;
  selectScope: (scopeId: string | null) => void;

  addBlock: (block: BlockUpsertInput) => string;
  insertStructuredBlock: (input: StructuredAssistInput) => string | null;
  updateBlock: (id: string, updates: BlockUpsertInput) => void;
  updateBlockBody: (id: string, body: string) => void;
  updateBlockTitle: (id: string, title?: string) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, newIndex: number) => void;

  selectBlock: (id: string | null) => void;

  addSkill: (skill: Partial<UamCapabilityV1>) => string;
  updateSkill: (id: string, updates: Partial<UamCapabilityV1>) => void;
  removeSkill: (id: string) => void;
  selectSkill: (id: string | null) => void;

  toggleTarget: (targetId: string) => void;
  setCompilationResult: (result: CompilationResult | null) => void;
  setAutosaveStatus: (status: AutosaveStatus) => void;
  saveArtifact: () => Promise<string | null>;
  setSaveConflict: (conflict: SaveConflict) => void;
  clearSaveConflict: () => void;
  setSecretScan: (scan: SecretScanState) => void;
  setSecretScanAck: (acknowledged: boolean) => void;
  clearSecretScan: () => void;
  reloadArtifact: () => Promise<void>;
  resetDraft: () => void;
  discardDraft: () => void;
  initializeFromTemplate: (uam: UamV1) => void;
  loadArtifact: (idOrSlug: string) => Promise<ArtifactLoadResult>;
  applyScanContext: (context: ScanContext) => void;
  clearScanContext: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 500;
const SCAN_TOOL_TARGET_MAP: Record<SimulatorToolId, string> = {
  'codex-cli': 'agents-md',
  'claude-code': 'claude-code',
  'gemini-cli': 'gemini-cli',
  'github-copilot': 'github-copilot',
  'copilot-cli': 'github-copilot',
  cursor: 'cursor-rules',
};

function targetIdForScanTool(tool: SimulatorToolId): string | null {
  return SCAN_TOOL_TARGET_MAP[tool] ?? null;
}

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set, get) => {
      const markDirty = () => {
        const status = get().autosaveStatus;
        const next: Partial<WorkbenchState> = {};
        if (status !== 'saving') next.autosaveStatus = 'saving';
        if (get().secretScan.status !== 'idle' || get().secretScanAck) {
          next.secretScan = { status: 'idle', matches: [] };
          next.secretScanAck = false;
        }
        if (Object.keys(next).length > 0) set(next);
      };

      const onPersisted = debounce(() => {
        set({ autosaveStatus: 'saved', lastSavedAt: Date.now() });
      }, AUTOSAVE_DEBOUNCE_MS);

      const deriveFromUam = (uam: UamV1, selectedScopeIdHint: string | null | undefined) => {
        const normalized = normalizeWorkbenchUam(uam);
        const selectedScopeId = ensureSelectedScopeId(normalized, selectedScopeIdHint);
        const selectedSkillId = ensureSelectedSkillId(normalized, get().selectedSkillId);
        const scopes = normalized.scopes.map(legacyScopeLabel);
        const blocks = syncLegacyBlocksFromUam(normalized.blocks);
        const targets = normalized.targets;

        return {
          uam: normalized,
          selectedScopeId,
          selectedSkillId,
          selectedScope: legacyScopeLabel(normalized.scopes.find(s => s.id === selectedScopeId) ?? normalized.scopes[0]!),
          title: normalized.meta.title,
          description: normalized.meta.description ?? '',
          scopes,
          blocks,
          targets,
          skills: normalized.capabilities,
        };
      };

      return {
        id: undefined,
        uam: createEmptyUamV1({ title: 'Untitled Agent' }),
        baselineUam: null,
        baselineVersion: null,
        baselineUpdatedAt: null,

        title: 'Untitled Agent',
        description: '',
        scopes: ['root'],
        blocks: [],
        targets: [],
        skills: [],

        selectedScopeId: GLOBAL_SCOPE_ID,
        selectedScope: 'root',
        selectedBlockId: null,
        selectedSkillId: null,

        visibility: 'PRIVATE',
        tags: [],

        compilationResult: null,
        autosaveStatus: 'idle',
        lastSavedAt: null,
        cloudSaveStatus: 'idle',
        cloudLastSavedAt: null,
        saveConflict: { status: 'idle' },
        secretScan: { status: 'idle', matches: [] },
        secretScanAck: false,
        scanContext: null,

        setId: (id) => set({ id }),

        setTitle: (title) => {
          set((state) => ({
            title,
            uam: { ...state.uam, meta: { ...state.uam.meta, title } },
          }));
          markDirty();
          onPersisted();
        },

        setDescription: (description) => {
          set((state) => ({
            description,
            uam: { ...state.uam, meta: { ...state.uam.meta, description } },
          }));
          markDirty();
          onPersisted();
        },

        setVisibility: (visibility) => {
          set({ visibility });
          markDirty();
          onPersisted();
        },

        setTags: (tags) => {
          set({ tags });
          markDirty();
          onPersisted();
        },

        setUam: (uam) => {
          set(deriveFromUam(uam, get().selectedScopeId));
          markDirty();
          onPersisted();
        },

        addScope: (scopeInput) => {
          const scope: UamScopeV1 = (() => {
            if ('id' in scopeInput && 'kind' in scopeInput) {
              return scopeInput as UamScopeV1;
            }

            const id = (scopeInput as { id?: string }).id ?? randomId();
            if (scopeInput.kind === 'global') return { id, kind: 'global', name: scopeInput.name };
            if (scopeInput.kind === 'dir') return { id, kind: 'dir', dir: scopeInput.dir ?? '', name: scopeInput.name };
            return { id, kind: 'glob', patterns: scopeInput.patterns ?? [], name: scopeInput.name };
          })();

          set((state) => {
            if (state.uam.scopes.some(s => s.id === scope.id)) return {};
            const uam = { ...state.uam, scopes: [...state.uam.scopes, scope] };
            return { uam, scopes: uam.scopes.map(legacyScopeLabel) };
          });
          markDirty();
          onPersisted();
          return scope.id;
        },

        removeScope: (scopeId) => {
          set((state) => {
            const remainingScopes = state.uam.scopes.filter(s => s.id !== scopeId);
            const remainingBlocks = state.uam.blocks.filter(b => b.scopeId !== scopeId);
            const normalized = ensureGlobalScope({ ...state.uam, scopes: remainingScopes, blocks: remainingBlocks });
            const selectedScopeId = ensureSelectedScopeId(normalized, state.selectedScopeId === scopeId ? null : state.selectedScopeId);

            return {
              uam: normalized,
              selectedScopeId,
              selectedScope:
                legacyScopeLabel(normalized.scopes.find(s => s.id === selectedScopeId) ?? normalized.scopes[0]!),
              scopes: normalized.scopes.map(legacyScopeLabel),
              blocks: syncLegacyBlocksFromUam(remainingBlocks),
              selectedBlockId: remainingBlocks.some(b => b.id === state.selectedBlockId) ? state.selectedBlockId : null,
            };
          });
          markDirty();
          onPersisted();
        },

        selectScope: (scopeId) => {
          set((state) => {
            if (!scopeId) {
              return { selectedScopeId: state.selectedScopeId, selectedScope: state.selectedScope };
            }
            const scope = state.uam.scopes.find(s => s.id === scopeId);
            if (!scope) return {};
            return { selectedScopeId: scopeId, selectedScope: legacyScopeLabel(scope) };
          });
          onPersisted();
        },

        addBlock: (blockInput) => {
          const id = blockInput.id ?? randomId();
          const type: UAMBlockType = (blockInput.type as UAMBlockType | undefined) ?? 'instruction';
          const content = blockInput.content ?? blockInput.body ?? '';
          const scopeId = blockInput.scopeId ?? get().selectedScopeId;
          const kind: UamBlockKindV1 = blockInput.kind ?? 'markdown';

          const uamBlock: UamBlockV1 = {
            id,
            scopeId,
            kind,
            title: blockInput.title,
            body: content,
            ...(blockInput.type ? { type: blockInput.type } : {}),
            ...(blockInput.content ? { content: blockInput.content } : {}),
          } as unknown as UamBlockV1;

          set((state) => ({
            blocks: [...state.blocks, { id, type, content }],
            uam: { ...state.uam, blocks: [...state.uam.blocks, uamBlock] },
          }));
          markDirty();
          onPersisted();
          return id;
        },

        insertStructuredBlock: (input) => {
          const trimmedTitle = input.blockTitle?.trim() || undefined;
          const trimmedScopeName = input.scopeName?.trim() || undefined;
          const defaults = getStructuredBlockDefaults(input.blockKind);

          let targetScopeId = get().selectedScopeId;
          let uam = normalizeWorkbenchUam(get().uam);
          let scopes = [...uam.scopes];

          if (input.scopeKind === 'global') {
            uam = ensureGlobalScope(uam);
            scopes = [...uam.scopes];
            targetScopeId = GLOBAL_SCOPE_ID;
          }

          if (input.scopeKind === 'dir') {
            const normalizedDir = normalizeDirScope(input.scopeValue ?? '');
            if (!normalizedDir) return null;
            const existing = scopes.find(
              (scope) => scope.kind === 'dir' && normalizeDirScope(scope.dir) === normalizedDir
            );
            if (existing) {
              targetScopeId = existing.id;
            } else {
              const scopeId = randomId();
              scopes = [...scopes, { id: scopeId, kind: 'dir', dir: normalizedDir, name: trimmedScopeName }];
              targetScopeId = scopeId;
            }
          }

          if (input.scopeKind === 'glob') {
            const pattern = (input.scopeValue ?? '').trim();
            if (!pattern) return null;
            const existing = scopes.find(
              (scope) => scope.kind === 'glob' && scope.patterns.some((entry) => entry === pattern)
            );
            if (existing) {
              targetScopeId = existing.id;
            } else {
              const scopeId = randomId();
              scopes = [...scopes, { id: scopeId, kind: 'glob', patterns: [pattern], name: trimmedScopeName }];
              targetScopeId = scopeId;
            }
          }

          if (input.scopeKind === 'current') {
            targetScopeId = ensureSelectedScopeId(uam, targetScopeId);
          }

          const nextUam = { ...uam, scopes };
          const scopedId = ensureSelectedScopeId(nextUam, targetScopeId);
          const blockId = randomId();
          const nextBlock: UamBlockV1 = {
            id: blockId,
            scopeId: scopedId,
            kind: input.blockKind,
            title: trimmedTitle ?? defaults.title,
            body: defaults.body,
          };
          const nextBlocks = [...nextUam.blocks, nextBlock];
          const normalized = normalizeWorkbenchUam({ ...nextUam, blocks: nextBlocks });
          const selectedScopeId = ensureSelectedScopeId(normalized, scopedId);
          const selectedScope =
            legacyScopeLabel(normalized.scopes.find((scope) => scope.id === selectedScopeId) ?? normalized.scopes[0]!);

          set({
            uam: normalized,
            blocks: syncLegacyBlocksFromUam(normalized.blocks),
            scopes: normalized.scopes.map(legacyScopeLabel),
            selectedScopeId,
            selectedScope,
            selectedBlockId: blockId,
          });
          markDirty();
          onPersisted();
          return blockId;
        },

        updateBlock: (id, updates) => {
          set((state) => {
            const blocks = state.blocks.map(b => {
              if (b.id !== id) return b;
              return {
                ...b,
                ...(updates.type ? { type: updates.type as UAMBlockType } : {}),
                ...(typeof updates.content === 'string' ? { content: updates.content } : {}),
              };
            });

            const uamBlocks = state.uam.blocks.map(b => {
              if (b.id !== id) return b;
              const nextBody = typeof updates.body === 'string' ? updates.body : typeof updates.content === 'string' ? updates.content : b.body;
              const nextTitle = updates.title ?? b.title;
              const nextKind = updates.kind ?? b.kind;
              const nextScopeId = updates.scopeId ?? b.scopeId;
              return {
                ...b,
                ...(updates.type ? { type: updates.type } : {}),
                ...(typeof updates.content === 'string' ? { content: updates.content } : {}),
                body: nextBody,
                title: nextTitle,
                kind: nextKind,
                scopeId: nextScopeId,
              } as unknown as UamBlockV1;
            });

            return { blocks, uam: { ...state.uam, blocks: uamBlocks } };
          });
          markDirty();
          onPersisted();
        },

        updateBlockBody: (id, body) => {
          get().updateBlock(id, { body, content: body });
        },

        updateBlockTitle: (id, title) => {
          get().updateBlock(id, { title });
        },

        removeBlock: (id) => {
          set((state) => ({
            blocks: state.blocks.filter(b => b.id !== id),
            uam: { ...state.uam, blocks: state.uam.blocks.filter(b => b.id !== id) },
            selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
          }));
          markDirty();
          onPersisted();
        },

        moveBlock: (id, newIndex) => {
          set((state) => {
            const scopeIdByBlockId = new Map(state.uam.blocks.map(b => [b.id, b.scopeId] as const));
            const scopeId = scopeIdByBlockId.get(id);
            if (!scopeId) return {};

            const indices: number[] = [];
            const scopedBlocks: UAMBlock[] = [];
            state.blocks.forEach((b, idx) => {
              if (scopeIdByBlockId.get(b.id) === scopeId) {
                indices.push(idx);
                scopedBlocks.push(b);
              }
            });

            const fromIndex = scopedBlocks.findIndex(b => b.id === id);
            if (fromIndex === -1) return {};

            const nextScoped = [...scopedBlocks];
            const [moved] = nextScoped.splice(fromIndex, 1);
            nextScoped.splice(newIndex, 0, moved);

            const nextBlocks = [...state.blocks];
            indices.forEach((originalIdx, i) => {
              nextBlocks[originalIdx] = nextScoped[i]!;
            });

            const nextUamBlocks = state.uam.blocks
              .slice()
              .sort((a, b) => nextBlocks.findIndex(lb => lb.id === a.id) - nextBlocks.findIndex(lb => lb.id === b.id));

            return { blocks: nextBlocks, uam: { ...state.uam, blocks: nextUamBlocks } };
          });
          markDirty();
          onPersisted();
        },

        selectBlock: (id) => {
          set({ selectedBlockId: id });
          onPersisted();
        },

        addSkill: (skillInput) => {
          const id = skillInput.id?.trim() || `skill_${randomId()}`;
          const skill: UamCapabilityV1 = {
            id,
            title: skillInput.title?.trim() || undefined,
            description: skillInput.description?.trim() || undefined,
            params: skillInput.params,
          };

          set((state) => {
            if (state.uam.capabilities.some((cap) => cap.id === id)) return {};
            const nextCapabilities = [...state.uam.capabilities, skill];
            return {
              skills: nextCapabilities,
              selectedSkillId: id,
              uam: { ...state.uam, capabilities: nextCapabilities },
            };
          });
          markDirty();
          onPersisted();
          return id;
        },

        updateSkill: (id, updates) => {
          set((state) => {
            const nextCapabilities = state.uam.capabilities.map((cap) =>
              cap.id === id
                ? {
                    ...cap,
                    ...(typeof updates.title === 'string' ? { title: updates.title.trim() || undefined } : {}),
                    ...(typeof updates.description === 'string'
                      ? { description: updates.description.trim() || undefined }
                      : {}),
                    ...(updates.params ? { params: updates.params } : {}),
                  }
                : cap
            );
            return { skills: nextCapabilities, uam: { ...state.uam, capabilities: nextCapabilities } };
          });
          markDirty();
          onPersisted();
        },

        removeSkill: (id) => {
          set((state) => {
            const nextCapabilities = state.uam.capabilities.filter((cap) => cap.id !== id);
            const nextSelected = state.selectedSkillId === id ? nextCapabilities[0]?.id ?? null : state.selectedSkillId;
            return {
              skills: nextCapabilities,
              selectedSkillId: nextSelected,
              uam: { ...state.uam, capabilities: nextCapabilities },
            };
          });
          markDirty();
          onPersisted();
        },

        selectSkill: (id) => {
          set((state) => {
            if (!id) return { selectedSkillId: null };
            if (!state.uam.capabilities.some((cap) => cap.id === id)) return {};
            return { selectedSkillId: id };
          });
          onPersisted();
        },

        toggleTarget: (targetId) => {
          set((state) => {
            const nextTargets = state.targets.some((t) => t.targetId === targetId)
              ? state.targets.filter((t) => t.targetId !== targetId)
              : [...state.targets, createUamTargetV1(targetId)];
            return { targets: nextTargets, uam: { ...state.uam, targets: nextTargets } };
          });
          markDirty();
          onPersisted();
        },

        setCompilationResult: (result) => set({ compilationResult: result }),
        setAutosaveStatus: (status) => set({ autosaveStatus: status }),

        saveArtifact: async () => {
          const state = get();
          set({ cloudSaveStatus: 'saving', saveConflict: { status: 'idle' } });

          try {
            const requiresSecretAck = state.visibility === 'PUBLIC' || state.visibility === 'UNLISTED';
            if (requiresSecretAck) {
              const scan = scanUamForSecrets(state.uam);
              if (scan.hasSecrets && !state.secretScanAck) {
                set({
                  cloudSaveStatus: 'idle',
                  secretScan: {
                    status: 'blocked',
                    matches: scan.matches.map(match => ({ label: match.label, redacted: match.redacted })),
                    checkedAt: Date.now(),
                  },
                });
                return null;
              }
            }

            const payload = {
              id: state.id,
              title: state.title,
              tags: state.tags,
              visibility: state.visibility,
              uam: state.uam,
              message: 'Saved via Workbench',
              ...(requiresSecretAck ? { secretScanAck: true } : {}),
              ...(state.baselineVersion ? { expectedVersion: state.baselineVersion } : {}),
              ...(state.baselineUpdatedAt ? { expectedUpdatedAt: state.baselineUpdatedAt } : {}),
            };

            const res = await fetch('/api/artifacts/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (res.status === 409) {
              const body = (await res.json().catch(() => null)) as { details?: SaveConflictDetails } | null;
              set({
                cloudSaveStatus: 'error',
                saveConflict: {
                  status: 'conflict',
                  details: body?.details,
                },
              });
              return null;
            }

            if (!res.ok) {
              const body = await res.json().catch(() => null);
              const message = body?.error ?? 'Save failed';
              throw new Error(message);
            }

            const data = (await res.json()) as { id?: string; updatedAt?: string };
            if (data.id) {
              state.setId(data.id);
            }

            const nextBaselineVersion = (() => {
              if (state.baselineVersion) {
                const parsed = Number.parseInt(state.baselineVersion, 10);
                return Number.isFinite(parsed) ? String(parsed + 1) : state.baselineVersion;
              }
              if (!state.id && data.id) return '1';
              return state.baselineVersion ?? null;
            })();

            set({
              cloudSaveStatus: 'saved',
              cloudLastSavedAt: Date.now(),
              baselineUam: state.uam,
              baselineVersion: nextBaselineVersion,
              baselineUpdatedAt: data.updatedAt ?? state.baselineUpdatedAt,
              saveConflict: { status: 'idle' },
              secretScan: { status: 'idle', matches: [] },
              secretScanAck: false,
            });
            return data.id ?? null;
          } catch (err) {
            console.error(err);
            set({ cloudSaveStatus: 'error' });
            return null;
          } finally {
            if (state.secretScanAck) {
              set({ secretScanAck: false });
            }
          }
        },

        setSaveConflict: (conflict) => set({ saveConflict: conflict }),

        clearSaveConflict: () => set({ saveConflict: { status: 'idle' } }),

        setSecretScan: (scan) => set({ secretScan: scan }),

        setSecretScanAck: (acknowledged) => set({ secretScanAck: acknowledged }),

        clearSecretScan: () => set({ secretScan: { status: 'idle', matches: [] }, secretScanAck: false }),

        reloadArtifact: async () => {
          const artifactId = get().id;
          if (!artifactId) {
            set({ saveConflict: { status: 'idle' } });
            return;
          }
          await get().loadArtifact(artifactId);
          set({ saveConflict: { status: 'idle' } });
        },

        resetDraft: () => {
          const uam = createEmptyUamV1({ title: 'Untitled Agent' });
          set({
            id: undefined,
            uam,
            baselineUam: null,
            baselineVersion: null,
            baselineUpdatedAt: null,
            title: uam.meta.title,
            description: uam.meta.description ?? '',
            scopes: ['root'],
            blocks: [],
            targets: [],
            selectedScopeId: GLOBAL_SCOPE_ID,
            selectedScope: 'root',
            selectedBlockId: null,
            compilationResult: null,
            autosaveStatus: 'idle',
            lastSavedAt: null,
            visibility: 'PRIVATE',
            tags: [],
            cloudSaveStatus: 'idle',
            cloudLastSavedAt: null,
            saveConflict: { status: 'idle' },
            secretScan: { status: 'idle', matches: [] },
            secretScanAck: false,
            scanContext: null,
          });
          onPersisted();
        },

        discardDraft: () => {
          const uam = createEmptyUamV1({ title: 'Untitled Agent' });
          set({
            id: undefined,
            uam,
            baselineUam: null,
            baselineVersion: null,
            baselineUpdatedAt: null,
            title: uam.meta.title,
            description: uam.meta.description ?? '',
            scopes: ['root'],
            blocks: [],
            targets: [],
            selectedScopeId: GLOBAL_SCOPE_ID,
            selectedScope: 'root',
            selectedBlockId: null,
            compilationResult: null,
            autosaveStatus: 'idle',
            lastSavedAt: null,
            visibility: 'PRIVATE',
            tags: [],
            cloudSaveStatus: 'idle',
            cloudLastSavedAt: null,
            saveConflict: { status: 'idle' },
            secretScan: { status: 'idle', matches: [] },
            secretScanAck: false,
            scanContext: null,
          });
          clearStoredWorkbenchDraft();
        },

        initializeFromTemplate: (templateUam) => {
          const normalized = normalizeWorkbenchUam(templateUam);
          set({
            id: undefined,
            ...deriveFromUam(normalized, null),
            baselineUam: normalized,
            baselineVersion: null,
            baselineUpdatedAt: null,
            selectedBlockId: null,
            compilationResult: null,
            autosaveStatus: 'idle',
            lastSavedAt: null,
            visibility: 'PRIVATE',
            tags: [],
            cloudSaveStatus: 'idle',
            cloudLastSavedAt: null,
            saveConflict: { status: 'idle' },
            secretScan: { status: 'idle', matches: [] },
            secretScanAck: false,
            scanContext: null,
          });
          markDirty();
          onPersisted();
        },

        loadArtifact: async (idOrSlug) => {
          try {
            const res = await fetch(`/api/artifacts/${idOrSlug}`);
            if (!res.ok) {
              const body = await res.json().catch(() => null);
              const message =
                typeof body?.error === 'string' && body.error.length > 0
                  ? body.error
                  : `Failed to load artifact (${res.status})`;
              throw new Error(message);
            }

            const data = (await res.json()) as {
              artifact?: { id?: string; visibility?: unknown; tags?: unknown };
              latestVersion?: { uam?: unknown; version?: unknown };
            };
            const artifactId = data.artifact?.id ?? idOrSlug;
            const visibility = data.artifact?.visibility;
            const tags = data.artifact?.tags;
            const updatedAt = (data.artifact as { updatedAt?: unknown } | undefined)?.updatedAt;
            const uam = data.latestVersion?.uam;
            if (!uam) throw new Error('Artifact has no versions');

            const parsed = safeParseUamV1(uam);
            if (!parsed.success) throw new Error('Artifact has invalid UAM');

            const normalized = normalizeWorkbenchUam(parsed.data);
            const baselineVersion =
              typeof data.latestVersion?.version === 'string' ? data.latestVersion.version : null;
            const baselineUpdatedAt = typeof updatedAt === 'string' ? updatedAt : null;
            set({
              id: artifactId,
              ...deriveFromUam(normalized, get().selectedScopeId),
              baselineUam: normalized,
              baselineVersion,
              baselineUpdatedAt,
              selectedBlockId: null,
              compilationResult: null,
              autosaveStatus: 'idle',
              lastSavedAt: null,
              visibility:
                visibility === 'PUBLIC' || visibility === 'UNLISTED' || visibility === 'PRIVATE'
                  ? visibility
                  : 'PRIVATE',
              tags: Array.isArray(tags) ? tags.map(v => String(v).trim()).filter(Boolean) : [],
              cloudSaveStatus: 'idle',
              cloudLastSavedAt: null,
              saveConflict: { status: 'idle' },
              secretScan: { status: 'idle', matches: [] },
              secretScanAck: false,
              scanContext: null,
            });
            return { status: 'loaded', title: normalized.meta.title ?? 'Untitled Agent' };
          } catch (err) {
            console.error(err);
            return {
              status: 'error',
              message: err instanceof Error ? err.message : 'Failed to load artifact',
            };
          }
        },

        applyScanContext: (context) => {
          const nextContext = {
            tool: context.tool,
            cwd: normalizeDirScope(context.cwd ?? ''),
            paths: normalizeScanPaths(context.paths ?? []),
          };
          set({ scanContext: nextContext });
          writeStoredScanContext(nextContext);
          const targetId = targetIdForScanTool(nextContext.tool);
          if (!targetId) return;
          const nextUam = { ...get().uam, targets: [createUamTargetV1(targetId)] };
          get().setUam(nextUam);
        },

        clearScanContext: () => {
          const context = get().scanContext;
          set({ scanContext: null });
          clearStoredScanContext();
          if (!context) return;
          const targetId = targetIdForScanTool(context.tool);
          if (!targetId) return;
          const currentTargets = get().uam.targets;
          if (currentTargets.length === 1 && currentTargets[0]?.targetId === targetId) {
            const nextUam = { ...get().uam, targets: [] };
            get().setUam(nextUam);
          }
        },
      };
    },
    {
      name: WORKBENCH_STORAGE_KEY,
      version: WORKBENCH_STORAGE_VERSION,
      storage: createJSONStorage(() => safeLocalStorage()),
      partialize: (state): PersistedWorkbenchState => ({
        id: state.id,
        uam: state.uam,
        selectedScopeId: state.selectedScopeId,
        selectedBlockId: state.selectedBlockId,
        selectedSkillId: state.selectedSkillId,
        visibility: state.visibility,
        tags: state.tags,
        lastSavedAt: state.lastSavedAt,
      }),
      migrate: (persistedState, version) => {
        const raw = (persistedState as { state?: unknown })?.state ?? persistedState;

        if (version >= 2 && isRecord(raw) && 'uam' in raw) {
          const persisted = raw as PersistedWorkbenchState;
          const normalized = normalizeWorkbenchUam(persisted.uam);
          return {
            id: persisted.id,
            uam: normalized,
            selectedBlockId: persisted.selectedBlockId ?? null,
            selectedScopeId: persisted.selectedScopeId,
            selectedSkillId: persisted.selectedSkillId ?? null,
            visibility: persisted.visibility,
            tags: persisted.tags,
            lastSavedAt: typeof persisted.lastSavedAt === 'number' ? persisted.lastSavedAt : null,
          } satisfies PersistedWorkbenchState;
        }

        // Legacy v0/v1 store migration (pre-UAM v1)
        const legacy = raw as Partial<{
          id?: string;
          title?: string;
          description?: string;
          blocks?: UAMBlock[];
          scopes?: string[];
          selectedScope?: string | null;
          selectedBlockId?: string | null;
          targets?: string[];
        }>;

        const base = createEmptyUamV1({
          title: legacy.title ?? 'Untitled Agent',
          description: legacy.description ?? '',
        });

        const selectedScopeId = GLOBAL_SCOPE_ID;
        const blocks = legacy.blocks ?? [];
        const uamBlocks = syncUamBlocksFromLegacy(blocks, selectedScopeId);

        const targets = legacy.targets ?? [];
        const uamTargets = syncUamTargetsFromLegacy(targets);

        const uam = normalizeWorkbenchUam({ ...base, blocks: uamBlocks, targets: uamTargets });

        return {
          id: legacy.id,
          uam,
          selectedBlockId: legacy.selectedBlockId ?? null,
          selectedScopeId,
          selectedSkillId: null,
          lastSavedAt: null,
        } satisfies PersistedWorkbenchState;
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as unknown as PersistedWorkbenchState) ?? {};
        const next = { ...currentState, ...persisted } as WorkbenchState;

        const normalized = normalizeWorkbenchUam(next.uam);
        const selectedScopeId = ensureSelectedScopeId(normalized, next.selectedScopeId);
        const selectedSkillId = ensureSelectedSkillId(normalized, next.selectedSkillId);

        return {
          ...next,
          uam: normalized,
          selectedScopeId,
          selectedSkillId,
          selectedScope:
            legacyScopeLabel(normalized.scopes.find(s => s.id === selectedScopeId) ?? normalized.scopes[0]!),
          title: normalized.meta.title,
          description: normalized.meta.description ?? '',
          scopes: normalized.scopes.map(legacyScopeLabel),
          blocks: syncLegacyBlocksFromUam(normalized.blocks),
          targets: normalized.targets,
          skills: normalized.capabilities,
          visibility: next.visibility ?? 'PRIVATE',
          tags: next.tags ?? [],
        };
      },
    }
  )
);
