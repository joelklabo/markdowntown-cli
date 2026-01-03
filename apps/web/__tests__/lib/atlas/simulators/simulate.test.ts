import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { simulateContextResolution } from '@/lib/atlas/simulators/simulate';

type FixtureFile = {
  id: string;
  defaultCwd: string;
  files: Array<{ path: string; content: string }>;
};

function loadFixture(name: string): FixtureFile {
  const filePath = path.join(process.cwd(), 'atlas', 'examples', 'repo-trees', `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as FixtureFile;
}

describe('atlas/simulators/simulate', () => {
  it('resolves tool context files for a shared fixture tree', () => {
    const fixture = loadFixture('monorepo');
    const tree = { files: fixture.files };

    expect(
      simulateContextResolution({ tool: 'github-copilot', tree, cwd: fixture.defaultCwd }).loaded.map(x => x.path),
    ).toEqual(['.github/copilot-instructions.md', '.github/instructions/apps-web.instructions.md']);

    expect(
      simulateContextResolution({ tool: 'copilot-cli', tree, cwd: fixture.defaultCwd }).loaded.map(x => x.path),
    ).toEqual([
      '.github/copilot-instructions.md',
      '.github/copilot-instructions/apps-web.instructions.md',
      '.github/agents/release.agent.md',
    ]);

    expect(
      simulateContextResolution({ tool: 'claude-code', tree, cwd: fixture.defaultCwd }).loaded.map(x => x.path),
    ).toEqual(['CLAUDE.md']);

    expect(
      simulateContextResolution({ tool: 'gemini-cli', tree, cwd: fixture.defaultCwd }).loaded.map(x => x.path),
    ).toEqual(['GEMINI.md']);

    expect(
      simulateContextResolution({ tool: 'codex-cli', tree, cwd: fixture.defaultCwd }).loaded.map(x => x.path),
    ).toEqual(['AGENTS.md', 'apps/web/AGENTS.md']);
  });

  it('emits scan-risk warnings for large trees', () => {
    const fixture = loadFixture('deep-tree');
    const tree = { files: fixture.files };
    const result = simulateContextResolution({ tool: 'codex-cli', tree, cwd: fixture.defaultCwd });

    expect(result.warnings.some(w => w.code === 'scan-risk.large-tree')).toBe(true);
    expect(result.warnings.some(w => w.code === 'scan-risk.cursor-rules')).toBe(true);
  });

  it('loads Cursor rules and legacy file with reasons', () => {
    const tree = {
      files: [
        { path: '.cursor/rules/general.mdc', content: '' },
        { path: '.cursor/rules/typing.mdc', content: '' },
        { path: '.cursorrules', content: '' },
      ],
    };

    const result = simulateContextResolution({ tool: 'cursor', tree, cwd: '' });

    expect(result.loaded).toEqual([
      { path: '.cursor/rules/general.mdc', reason: 'cursor rule (.cursor/rules/*.mdc)' },
      { path: '.cursor/rules/typing.mdc', reason: 'cursor rule (.cursor/rules/*.mdc)' },
      { path: '.cursorrules', reason: 'legacy cursor rules (.cursorrules, deprecated)' },
    ]);
    expect(result.warnings.some(w => w.code === 'deprecated.cursorrules')).toBe(true);
  });

  it('resolves Claude @path imports from CLAUDE.md', () => {
    const tree = {
      files: [
        { path: 'CLAUDE.md', content: '@docs/overview.md\n@prompts/base.md' },
        { path: 'docs/overview.md', content: '@../prompts/shared.md' },
        { path: 'prompts/base.md', content: 'Base instructions.' },
        { path: 'prompts/shared.md', content: 'Shared instructions.' },
      ],
    };

    const result = simulateContextResolution({ tool: 'claude-code', tree, cwd: '' });

    expect(result.loaded.map(item => item.path)).toEqual([
      'CLAUDE.md',
      'docs/overview.md',
      'prompts/shared.md',
      'prompts/base.md',
    ]);
  });
});
