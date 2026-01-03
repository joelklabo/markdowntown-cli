import { describe, expect, it } from 'vitest';
import { computeNextSteps } from '@/lib/atlas/simulators/nextSteps';
import type { NextStepsInput } from '@/lib/atlas/simulators/nextSteps';
import type {
  InstructionDiagnostic,
  InstructionDiagnostics,
  SimulatorInsights,
} from '@/lib/atlas/simulators/types';

const baseInsights: SimulatorInsights = {
  tool: 'codex-cli',
  expectedPatterns: [],
  foundFiles: [],
  missingFiles: [],
  precedenceNotes: [],
};

const makeDiagnostics = (diagnostics: InstructionDiagnostic[]): InstructionDiagnostics => ({
  tool: 'codex-cli',
  diagnostics,
});

const makeInput = (overrides: Partial<NextStepsInput> = {}): NextStepsInput => ({
  tool: 'codex-cli',
  repoSource: 'folder',
  repoFileCount: 1,
  isStale: false,
  diagnostics: makeDiagnostics([]),
  warnings: [],
  insights: baseInsights,
  extraFiles: [],
  ...overrides,
});

const diag = (overrides: Partial<InstructionDiagnostic>): InstructionDiagnostic => ({
  code: 'note.example',
  severity: 'info',
  message: 'Example issue.',
  ...overrides,
});

describe('atlas/simulators/nextSteps', () => {
  it('returns no-scan guidance when repo has no files', () => {
    const steps = computeNextSteps(
      makeInput({
        repoSource: 'manual',
        repoFileCount: 0,
      }),
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ id: 'no-scan', severity: 'info' });
    expect(steps[0].primaryAction?.id).toBe('paste-paths');
  });

  it('promotes scan upload CTA when repo source is folder', () => {
    const steps = computeNextSteps(
      makeInput({
        repoSource: 'folder',
        repoFileCount: 0,
      }),
    );

    expect(steps[0].id).toBe('no-scan');
    expect(steps[0].primaryAction?.id).toBe('scan-folder');
    const secondaryIds = steps[0].secondaryActions?.map((item) => item.id) ?? [];
    expect(secondaryIds).toContain('paste-paths');
  });

  it('orders steps by severity after stale', () => {
    const steps = computeNextSteps(
      makeInput({
        isStale: true,
        diagnostics: makeDiagnostics([
          diag({
            code: 'missing-cwd',
            severity: 'warning',
            message: 'CWD is required.',
          }),
          diag({
            code: 'missing.agents',
            severity: 'error',
            message: 'Missing AGENTS.md.',
          }),
          diag({
            code: 'note.example',
            severity: 'info',
            message: 'Informational note.',
          }),
        ]),
      }),
    );

    expect(steps[0].id).toBe('stale-results');
    expect(steps[1].severity).toBe('error');
    expect(steps[2].severity).toBe('warning');
    expect(steps[3].severity).toBe('info');
  });

  it('returns ready state when no issues and not stale', () => {
    const steps = computeNextSteps(makeInput());

    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('ready');
    expect(steps[0].severity).toBe('ready');
    expect(steps[0].primaryAction?.id).toBe('open-workbench');
    const secondaryIds = steps[0].secondaryActions?.map((item) => item.id) ?? [];
    expect(secondaryIds).toEqual(['copy-summary', 'download-report']);
  });

  it('includes expected path for missing root instructions', () => {
    const steps = computeNextSteps(
      makeInput({
        diagnostics: makeDiagnostics([
          diag({
            code: 'missing.claude',
            severity: 'error',
            message: 'No CLAUDE.md files found.',
            expectedPath: 'CLAUDE.md',
            suggestion: 'Add CLAUDE.md at the repo root.',
          }),
        ]),
      }),
    );

    expect(steps[0].title).toBe('Add the root instruction file');
    expect(steps[0].body).toContain('CLAUDE.md');
    expect(steps[0].primaryAction?.id).toBe('copy-template');
  });

  it('adds review-extra-files action when mixed tools are detected', () => {
    const steps = computeNextSteps(
      makeInput({
        diagnostics: makeDiagnostics([
          diag({
            code: 'mixed-tools',
            severity: 'warning',
            message: 'Instruction files for other tools were detected.',
          }),
        ]),
        extraFiles: ['AGENTS.md'],
      }),
    );

    expect(steps[0].id).toBe('mixed-tools');
    const secondaryIds = steps[0].secondaryActions?.map((item) => item.id) ?? [];
    expect(secondaryIds).toContain('review-extra-files');
  });

  it('suggests expected patterns when no missing diagnostics are present', () => {
    const steps = computeNextSteps(
      makeInput({
        diagnostics: makeDiagnostics([]),
        isStale: true,
        insights: {
          ...baseInsights,
          missingFiles: [
            { id: 'codex-cli.agents.root', label: 'Root', pattern: 'AGENTS.md' },
            { id: 'codex-cli.override.root', label: 'Override', pattern: 'AGENTS.override.md' },
          ],
        },
      }),
    );

    const missingStep = steps.find((step) => step.id === 'missing-patterns');
    expect(missingStep?.body).toContain('AGENTS.md');
  });

  it('guides large-tree warnings to scan smaller folders', () => {
    const steps = computeNextSteps(
      makeInput({
        warnings: [{ code: 'scan-risk.large-tree', message: 'Large tree' }],
        repoSource: 'folder',
      }),
    );

    expect(steps[0].id).toBe('warning:scan-risk.large-tree');
    expect(steps[0].primaryAction?.id).toBe('scan-smaller-folder');
    const secondaryIds = steps[0].secondaryActions?.map((item) => item.id) ?? [];
    expect(secondaryIds).toContain('paste-paths');
    expect(steps.some((step) => step.id === 'ready')).toBe(false);
  });
});
