import { describe, expect, it } from 'vitest';
import { computeSimulatorInsights } from '@/lib/atlas/simulators/insights';

describe('atlas/simulators/insights', () => {
  it('reports expected patterns and matches for GitHub Copilot', () => {
    const tree = {
      files: [
        { path: '.github/copilot-instructions.md', content: '' },
        { path: '.github/instructions/apps-web.instructions.md', content: '' },
      ],
    };

    const insights = computeSimulatorInsights({ tool: 'github-copilot', tree, cwd: '' });

    expect(insights.expectedPatterns.map(pattern => pattern.pattern)).toEqual([
      '.github/copilot-instructions.md',
      '.github/instructions/*.instructions.md',
    ]);
    expect(insights.foundFiles).toEqual([
      '.github/copilot-instructions.md',
      '.github/instructions/apps-web.instructions.md',
    ]);
    expect(insights.missingFiles).toHaveLength(0);
    expect(insights.precedenceNotes.length).toBeGreaterThan(0);
  });

  it('reports scoped instructions and agent profiles for Copilot CLI', () => {
    const tree = {
      files: [
        { path: '.github/copilot-instructions.md', content: '' },
        { path: '.github/copilot-instructions/apps-web.instructions.md', content: '' },
        { path: '.github/agents/release.agent.md', content: '' },
      ],
    };

    const insights = computeSimulatorInsights({ tool: 'copilot-cli', tree, cwd: '' });

    expect(insights.foundFiles).toEqual([
      '.github/copilot-instructions.md',
      '.github/copilot-instructions/apps-web.instructions.md',
      '.github/agents/release.agent.md',
    ]);
    expect(insights.missingFiles).toHaveLength(0);
  });

  it('handles Codex CLI ancestor scanning', () => {
    const tree = {
      files: [
        { path: 'AGENTS.md', content: '' },
        { path: 'apps/AGENTS.md', content: '' },
        { path: 'apps/web/AGENTS.override.md', content: '' },
      ],
    };

    const insights = computeSimulatorInsights({ tool: 'codex-cli', tree, cwd: 'apps/web' });
    const missingPatterns = insights.missingFiles.map(pattern => pattern.pattern);

    expect(insights.foundFiles).toEqual(['AGENTS.md', 'apps/AGENTS.md', 'apps/web/AGENTS.override.md']);
    expect(missingPatterns).toContain('AGENTS.override.md');
    expect(missingPatterns).toContain('apps/web/AGENTS.md');
    expect(insights.precedenceNotes.length).toBeGreaterThan(0);
  });

  it('normalizes cwd when building ancestor patterns', () => {
    const tree = {
      files: [
        { path: 'AGENTS.md', content: '' },
        { path: 'apps/AGENTS.md', content: '' },
        { path: 'apps/web/AGENTS.override.md', content: '' },
      ],
    };

    const insights = computeSimulatorInsights({ tool: 'codex-cli', tree, cwd: './apps\\web/' });
    const missingPatterns = insights.missingFiles.map(pattern => pattern.pattern);

    expect(insights.foundFiles).toEqual(['AGENTS.md', 'apps/AGENTS.md', 'apps/web/AGENTS.override.md']);
    expect(missingPatterns).toContain('apps/web/AGENTS.md');
  });

  it('reports Claude Code ancestor files', () => {
    const tree = {
      files: [
        { path: 'CLAUDE.md', content: '' },
        { path: 'apps/CLAUDE.md', content: '' },
      ],
    };

    const insights = computeSimulatorInsights({ tool: 'claude-code', tree, cwd: 'apps/web' });
    const missingPatterns = insights.missingFiles.map(pattern => pattern.pattern);

    expect(insights.foundFiles).toEqual(['CLAUDE.md', 'apps/CLAUDE.md']);
    expect(missingPatterns).toContain('apps/web/CLAUDE.md');
  });

  it('reports Gemini CLI ancestor files', () => {
    const tree = {
      files: [{ path: 'GEMINI.md', content: '' }],
    };

    const insights = computeSimulatorInsights({ tool: 'gemini-cli', tree, cwd: 'apps/web' });
    const missingPatterns = insights.missingFiles.map(pattern => pattern.pattern);

    expect(insights.foundFiles).toEqual(['GEMINI.md']);
    expect(missingPatterns).toContain('apps/GEMINI.md');
    expect(missingPatterns).toContain('apps/web/GEMINI.md');
  });

  it('reports Cursor rule patterns', () => {
    const tree = {
      files: [
        { path: '.cursor/rules/general.mdc', content: '' },
        { path: '.cursorrules', content: '' },
      ],
    };

    const insights = computeSimulatorInsights({ tool: 'cursor', tree, cwd: '' });

    expect(insights.expectedPatterns.map(pattern => pattern.pattern)).toEqual([
      '.cursor/rules/*.mdc',
      '.cursorrules',
    ]);
    expect(insights.foundFiles).toEqual(['.cursor/rules/general.mdc', '.cursorrules']);
    expect(insights.missingFiles).toHaveLength(0);
  });
});
