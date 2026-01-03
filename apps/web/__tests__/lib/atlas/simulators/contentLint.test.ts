import { describe, expect, it } from 'vitest';
import { lintInstructionContent } from '@/lib/atlas/simulators/contentLint';
import type { RepoTree, RepoTreeFile } from '@/lib/atlas/simulators/types';

const treeFromFiles = (files: RepoTreeFile[]): RepoTree => ({ files });

describe('atlas/simulators/contentLint', () => {
  it('warns when scoped Copilot instructions lack applyTo front matter', () => {
    const result = lintInstructionContent(
      treeFromFiles([
        {
          path: '.github/instructions/backend.instructions.md',
          content: 'Use the shared API client for requests.',
        },
      ]),
    );

    expect(result.checkedFiles).toBe(1);
    expect(result.skippedFiles).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: 'missing-front-matter',
      severity: 'warning',
      path: '.github/instructions/backend.instructions.md',
    });
  });

  it('reports skipped content when instruction files exceed size limits', () => {
    const result = lintInstructionContent(
      treeFromFiles([
        {
          path: 'AGENTS.md',
          content: '',
          contentStatus: 'skipped',
          contentReason: 'too-large',
        },
      ]),
    );

    expect(result.checkedFiles).toBe(0);
    expect(result.skippedFiles).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: 'content-too-large',
      severity: 'warning',
      path: 'AGENTS.md',
    });
  });

  it('flags truncated root content and missing command hints', () => {
    const result = lintInstructionContent(
      treeFromFiles([
        {
          path: 'CLAUDE.md',
          content: 'Follow the style guide and keep responses concise.',
          contentStatus: 'truncated',
        },
      ]),
    );

    const codes = result.issues.map((issue) => issue.code);
    expect(result.checkedFiles).toBe(1);
    expect(result.skippedFiles).toBe(0);
    expect(codes).toEqual(expect.arrayContaining(['content-truncated', 'missing-commands']));
  });
});
