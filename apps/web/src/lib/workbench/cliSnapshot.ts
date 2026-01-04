type SearchParamValue = string | string[] | undefined;
type WorkbenchSearchParams = Record<string, SearchParamValue>;

export type CliSnapshotContext = {
  repoId: string;
  snapshotId?: string | null;
  branch?: string | null;
  status?: 'ready' | 'pending';
};

function firstString(value: SearchParamValue): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

export function parseCliSnapshotContext(searchParams: WorkbenchSearchParams): CliSnapshotContext | null {
  const repoId = firstString(searchParams.cliRepoId)?.trim();
  if (!repoId) return null;
  const snapshotId = firstString(searchParams.cliSnapshotId)?.trim() ?? null;
  const branch = firstString(searchParams.cliBranch)?.trim() ?? null;
  const statusRaw = firstString(searchParams.cliStatus)?.trim()?.toLowerCase();
  const status = statusRaw === 'pending' ? 'pending' : statusRaw === 'ready' ? 'ready' : undefined;

  return {
    repoId,
    snapshotId,
    branch,
    status,
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
