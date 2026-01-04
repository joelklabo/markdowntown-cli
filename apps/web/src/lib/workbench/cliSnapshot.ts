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
  errorCode?: 'missing_repo' | 'invalid_status' | 'empty_param' | 'multi_value' | 'too_long' | 'unknown';
};

const CLI_PARAM_KEYS = ['cliRepoId', 'cliSnapshotId', 'cliBranch', 'cliStatus'] as const;
const CLI_PARAM_MAX_LENGTH = 200;

function normalizeParam(
  value: SearchParamValue,
  label: string
): { value: string | null; error?: string; errorCode?: CliSnapshotParseResult['errorCode'] } {
  if (Array.isArray(value)) {
    if (value.length > 1) {
      return { value: null, error: `${label} has multiple values.`, errorCode: 'multi_value' };
    }
    value = value[0];
  }
  if (typeof value !== 'string') return { value: null };
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: `${label} is empty.`, errorCode: 'empty_param' };
  if (trimmed.length > CLI_PARAM_MAX_LENGTH) {
    return { value: null, error: `${label} is too long.`, errorCode: 'too_long' };
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
    { message: repoIdParam.error, code: repoIdParam.errorCode },
    { message: snapshotIdParam.error, code: snapshotIdParam.errorCode },
    { message: branchParam.error, code: branchParam.errorCode },
    { message: statusParam.error, code: statusParam.errorCode },
  ].filter((entry) => Boolean(entry.message)) as Array<{ message: string; code?: CliSnapshotParseResult['errorCode'] }>;

  if (!repoIdParam.value) {
    errors.push({ message: 'Repository ID is required.', code: 'missing_repo' });
  }

  const statusRaw = statusParam.value?.toLowerCase();
  const status = statusRaw === 'pending' ? 'pending' : statusRaw === 'ready' ? 'ready' : undefined;
  if (statusParam.value && !status) {
    errors.push({ message: 'Status must be ready or pending.', code: 'invalid_status' });
  }

  if (errors.length > 0) {
    const [first] = errors;
    return { context: null, error: first.message, errorCode: first.code ?? 'unknown' };
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
