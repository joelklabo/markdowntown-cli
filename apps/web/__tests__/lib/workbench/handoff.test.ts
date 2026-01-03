import { describe, expect, it } from 'vitest';
import { parseScanContext } from '@/lib/workbench/handoff';

describe('workbench handoff', () => {
  it('parses valid scan context', () => {
    const result = parseScanContext({
      scanTool: 'codex-cli',
      scanCwd: ' /repo ',
      scanPaths: JSON.stringify(['README.md', 42, '', 'docs/guide.md']),
    });

    expect(result).toEqual({
      tool: 'codex-cli',
      cwd: '/repo',
      paths: ['README.md', '42', 'docs/guide.md'],
    });
  });

  it('returns empty paths for invalid JSON', () => {
    const result = parseScanContext({
      scanTool: 'gemini-cli',
      scanCwd: '/repo',
      scanPaths: '{',
    });

    expect(result).toEqual({
      tool: 'gemini-cli',
      cwd: '/repo',
      paths: [],
    });
  });

  it('returns null for unknown tool', () => {
    const result = parseScanContext({
      scanTool: 'unknown-cli',
      scanCwd: '/repo',
      scanPaths: JSON.stringify(['README.md']),
    });

    expect(result).toBeNull();
  });

  it('defaults missing params', () => {
    const result = parseScanContext({
      scanTool: 'claude-code',
    });

    expect(result).toEqual({
      tool: 'claude-code',
      cwd: '',
      paths: [],
    });
  });
});
