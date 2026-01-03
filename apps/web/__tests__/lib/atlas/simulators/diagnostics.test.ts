import { describe, expect, it } from 'vitest';
import { computeInstructionDiagnostics } from '@/lib/atlas/simulators/diagnostics';
import type { RepoTree } from '@/lib/atlas/simulators/types';

const treeFromPaths = (paths: string[]): RepoTree => ({
  files: paths.map((path) => ({ path, content: '' })),
});

describe('atlas/simulators/diagnostics', () => {
  it('detects Codex case mismatch and missing root instructions', () => {
    const result = computeInstructionDiagnostics({
      tool: 'codex-cli',
      tree: treeFromPaths(['agents.md']),
      cwd: 'src',
    });

    const codes = result.diagnostics.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining(['case-mismatch.agents', 'missing.agents', 'no-ancestor-instructions']),
    );

    const caseMismatch = result.diagnostics.find((item) => item.code === 'case-mismatch.agents');
    expect(caseMismatch?.severity).toBe('error');
    expect(caseMismatch?.suggestion).toBe('Rename the file to AGENTS.md (uppercase).');
  });

  it('warns when AGENTS.override.md lacks a base file', () => {
    const result = computeInstructionDiagnostics({
      tool: 'codex-cli',
      tree: treeFromPaths(['AGENTS.md', 'docs/AGENTS.override.md']),
      cwd: 'docs',
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'override-without-base',
      severity: 'warning',
      expectedPath: 'docs/AGENTS.md',
    });
  });

  it('flags Copilot CLI wrong folder and extension with actionable guidance', () => {
    const result = computeInstructionDiagnostics({
      tool: 'copilot-cli',
      tree: treeFromPaths([
        '.github/instructions/backend.instructions.md',
        '.github/copilot-instructions/bad.md',
      ]),
    });

    const codes = result.diagnostics.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'missing.copilot-cli',
        'wrong-folder.copilot-cli',
        'wrong-extension.copilot-cli',
        'mixed-tools',
      ]),
    );

    const missing = result.diagnostics.find((item) => item.code === 'missing.copilot-cli');
    expect(missing?.severity).toBe('error');
    expect(missing?.suggestion).toContain('.github/copilot-instructions.md');
  });

  it('warns when legacy .cursorrules exists alongside .cursor/rules', () => {
    const result = computeInstructionDiagnostics({
      tool: 'cursor',
      tree: treeFromPaths(['.cursor/rules/general.mdc', '.cursorrules']),
    });

    const warning = result.diagnostics.find((item) => item.code === 'deprecated.cursorrules');
    expect(warning?.severity).toBe('warning');
    expect(warning?.suggestion).toContain('.cursor/rules');
  });

  it('surfaces missing and circular Claude imports', () => {
    const tree: RepoTree = {
      files: [
        { path: 'CLAUDE.md', content: '@docs/missing.md\n@docs/a.md' },
        { path: 'docs/a.md', content: '@../CLAUDE.md' },
      ],
    };

    const result = computeInstructionDiagnostics({ tool: 'claude-code', tree });
    const codes = result.diagnostics.map((item) => item.code);

    expect(codes).toEqual(expect.arrayContaining(['claude-import.missing', 'claude-import.circular']));
  });
});
