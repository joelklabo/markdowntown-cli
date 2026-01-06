import { describe, expect, it } from 'vitest';
import {
  buildCliSnapshotCommand,
  formatCliSnapshotLabel,
  parseCliSnapshotContext,
} from '@/lib/workbench/cliSnapshot';

describe('cliSnapshot helpers', () => {
  it('parses valid CLI snapshot params', () => {
    const result = parseCliSnapshotContext({
      cliRepoId: ' demo-repo ',
      cliSnapshotId: 'snap-123',
      cliBranch: ' main ',
      cliStatus: 'ready',
    });

    expect(result).toEqual({
      context: {
        repoId: 'demo-repo',
        snapshotId: 'snap-123',
        branch: 'main',
        status: 'ready',
      },
    });
  });

  it('returns an error when repoId is missing', () => {
    const result = parseCliSnapshotContext({
      cliSnapshotId: 'snap-123',
    });

    expect(result.context).toBeNull();
    expect(result.error).toBe('Repository ID is required.');
  });

  it('returns an error for invalid status values', () => {
    const result = parseCliSnapshotContext({
      cliRepoId: 'demo-repo',
      cliStatus: 'invalid',
    });

    expect(result.context).toBeNull();
    expect(result.error).toBe('Status must be ready or pending.');
  });

  it('parses valid CLI snapshot params with uppercase status', () => {
    const result = parseCliSnapshotContext({
      cliRepoId: 'repo-1',
      cliStatus: 'READY',
    });

    expect(result.context?.status).toBe('ready');
  });

  it('rejects whitespace-only values as empty', () => {
    const result = parseCliSnapshotContext({
      cliRepoId: '   ',
    });

    expect(result.context).toBeNull();
    expect(result.errorCode).toBe('empty_param');
  });

  it('rejects values exceeding max length', () => {
    const result = parseCliSnapshotContext({
      cliRepoId: 'a'.repeat(201),
    });

    expect(result.context).toBeNull();
    expect(result.errorCode).toBe('too_long');
  });

  it('ignores unrelated query params', () => {
    const result = parseCliSnapshotContext({
      cliRepoId: 'demo-repo',
      extra: 'ignore-me',
    });

    expect(result).toEqual({
      context: {
        repoId: 'demo-repo',
        snapshotId: null,
        branch: null,
        status: undefined,
      },
    });
  });

  it('builds CLI pull command with optional flags', () => {
    expect(
      buildCliSnapshotCommand({
        repoId: 'demo-repo',
        snapshotId: 'snap-123',
        branch: 'main',
      })
    ).toBe('markdowntown sync pull --repo demo-repo --snapshot snap-123 --branch main');

    expect(
      buildCliSnapshotCommand({
        repoId: 'demo-repo',
        snapshotId: null,
        branch: null,
      })
    ).toBe('markdowntown sync pull --repo demo-repo');
  });

  it('formats snapshot labels with available metadata', () => {
    expect(
      formatCliSnapshotLabel({
        repoId: 'demo-repo',
        snapshotId: 'snap-123',
        branch: 'main',
      })
    ).toBe('Repo demo-repo · Snapshot snap-123 · Branch main');

    expect(
      formatCliSnapshotLabel({
        repoId: 'demo-repo',
      })
    ).toBe('Repo demo-repo');
  });
});
