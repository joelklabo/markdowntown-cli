type SearchParamValue = string | string[] | undefined;
type WorkbenchSearchParams = Record<string, SearchParamValue>;

export type CliSnapshotContext = {
  repoId: string;
  snapshotId?: string | null;
  branch?: string | null;
  status?: 'ready' | 'pending';
};

export type CliSnapshotParseResult = {
  context: CliSnapshotContext | null;
  error?: string | null;
};

const CLI_PARAM_KEYS = ['cliRepoId', 'cliSnapshotId', 'cliBranch', 'cliStatus'] as const;
const CLI_PARAM_MAX_LENGTH = 200;

function normalizeParam(value: SearchParamValue, label: string): { value: string | null; error?: string } {
  if (Array.isArray(value)) {
    if (value.length > 1) {
      return { value: null, error: `${label} has multiple values.` };
    }
    value = value[0];
  }
  if (typeof value !== 'string') return { value: null };
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: `${label} is empty.` };
  if (trimmed.length > CLI_PARAM_MAX_LENGTH) {
    return { value: null, error: `${label} is too long.` };
  }
  return { value: trimmed };
}

function hasAnyCliParams(searchParams: WorkbenchSearchParams): boolean {
  return CLI_PARAM_KEYS.some((key) => searchParams[key] !== undefined);
}

export function parseCliSnapshotContext(searchParams: WorkbenchSearchParams): CliSnapshotParseResult {
  if (!hasAnyCliParams(searchParams)) return { context: null };

  const repoIdParam = normalizeParam(searchParams.cliRepoId, 'Repository ID');
  const snapshotIdParam = normalizeParam(searchParams.cliSnapshotId, 'Snapshot ID');
  const branchParam = normalizeParam(searchParams.cliBranch, 'Branch');
  const statusParam = normalizeParam(searchParams.cliStatus, 'Status');
  const errors = [
    repoIdParam.error,
    snapshotIdParam.error,
    branchParam.error,
    statusParam.error,
  ].filter(Boolean) as string[];

  if (!repoIdParam.value) {
    errors.push('Repository ID is required.');
  }

  const statusRaw = statusParam.value?.toLowerCase();
  const status = statusRaw === 'pending' ? 'pending' : statusRaw === 'ready' ? 'ready' : undefined;
  if (statusParam.value && !status) {
    errors.push('Status must be ready or pending.');
  }

  if (errors.length > 0) {
    return { context: null, error: errors[0] };
  }

  return {
    context: {
      repoId: repoIdParam.value ?? '',
      snapshotId: snapshotIdParam.value ?? null,
      branch: branchParam.value ?? null,
      status,
    },
  };
}

export function buildCliSnapshotCommand(context: CliSnapshotContext): string {
  const parts = ['markdowntown', 'sync', 'pull', '--repo', context.repoId];
  if (context.snapshotId) {
    parts.push('--snapshot', context.snapshotId);
  }
  if (context.branch) {
    parts.push('--branch', context.branch);
  }
  return parts.join(' ');
}

export function formatCliSnapshotLabel(context: CliSnapshotContext): string {
  const parts = [`Repo ${context.repoId}`];
  if (context.snapshotId) parts.push(`Snapshot ${context.snapshotId}`);
  if (context.branch) parts.push(`Branch ${context.branch}`);
  return parts.join(' · ');
}
