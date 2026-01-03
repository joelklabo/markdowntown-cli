import type {
  InstructionDiagnostic,
  InstructionDiagnostics,
  NextStep,
  NextStepAction,
  NextStepActionId,
  SimulationWarning,
  SimulatorInsights,
  SimulatorToolId,
} from './types';

type RepoSource = 'manual' | 'folder';
type ScanErrorKind = 'permission-denied' | 'not-found' | 'generic';

export type NextStepsInput = {
  tool: SimulatorToolId;
  repoSource: RepoSource;
  repoFileCount: number;
  isStale: boolean;
  diagnostics: InstructionDiagnostics;
  warnings: SimulationWarning[];
  insights: SimulatorInsights;
  extraFiles: string[];
  scanError?: ScanErrorKind | null;
  truncated?: boolean;
};

const missingRootCodes = new Set<string>([
  'missing.agents',
  'missing.agents-root',
  'missing.claude',
  'missing.claude-root',
  'missing.gemini',
  'missing.gemini-root',
  'missing.copilot-cli',
  'missing.github-copilot',
]);

const action = (id: NextStepActionId, label: string): NextStepAction => ({ id, label });

function buildNoScanStep(repoSource: RepoSource): NextStep {
  const primary = repoSource === 'manual'
    ? action('paste-paths', 'Paste paths')
    : action('scan-folder', 'Upload a folder');
  const secondary = repoSource === 'manual'
    ? action('scan-folder', 'Upload a folder')
    : action('paste-paths', 'Paste paths');

  return {
    id: 'no-scan',
    severity: 'info',
    title: 'Upload a folder to get next steps',
    body: 'Upload a folder (or paste paths) so we can detect your tool and show what to fix.',
    primaryAction: primary,
    secondaryActions: [secondary],
  };
}

function buildScanErrorStep(kind: ScanErrorKind, repoSource: RepoSource): NextStep {
  const primary = repoSource === 'manual'
    ? action('paste-paths', 'Paste paths')
    : action('scan-folder', 'Upload a folder');
  const secondary = repoSource === 'manual'
    ? action('scan-folder', 'Upload a folder')
    : action('paste-paths', 'Paste paths');
  const message = kind === 'permission-denied'
    ? 'Permission denied. Choose a different folder and try again. Your files stay local.'
    : kind === 'not-found'
      ? 'Folder not found. Pick a different folder and try again. Your files stay local.'
      : 'Unable to scan folder. Check permissions and try again. Your files stay local.';

  return {
    id: `scan-error:${kind}`,
    severity: 'error',
    title: 'Scan failed',
    body: message,
    primaryAction: primary,
    secondaryActions: [secondary],
  };
}

function buildTruncatedStep(repoSource: RepoSource): NextStep {
  const primary = repoSource === 'folder'
    ? action('scan-smaller-folder', 'Scan a smaller folder')
    : action('paste-paths', 'Paste repo paths');
  const secondary = repoSource === 'folder'
    ? action('paste-paths', 'Paste repo paths')
    : action('scan-smaller-folder', 'Scan a smaller folder');
  return {
    id: 'scan-truncated',
    severity: 'warning',
    title: 'Scan limit reached',
    body: 'Results are truncated. Scan a smaller folder or paste paths to narrow the scope.',
    primaryAction: primary,
    secondaryActions: [secondary],
  };
}

function buildStaleStep(): NextStep {
  return {
    id: 'stale-results',
    severity: 'warning',
    title: 'Results are out of date',
    body: 'Your inputs changed. Re-run to refresh guidance.',
    primaryAction: action('refresh-results', 'Refresh results'),
    secondaryActions: [action('copy-summary', 'Copy summary')],
  };
}

function buildReadyStep(): NextStep {
  return {
    id: 'ready',
    severity: 'ready',
    title: "You're ready to go",
    body: 'These files should load for the selected tool. Open Workbench to continue or share the summary.',
    primaryAction: action('open-workbench', 'Open Workbench'),
    secondaryActions: [action('copy-summary', 'Copy summary'), action('download-report', 'Download report')],
  };
}

function buildMissingRootStep(diag: InstructionDiagnostic): NextStep {
  const guidance = diag.suggestion ?? (diag.expectedPath ? `Add ${diag.expectedPath}.` : diag.message);
  const prefix = diag.severity === 'warning'
    ? 'A root file helps ensure global instructions are loaded.'
    : "This tool won't load any instructions without a root file.";
  const body = `${prefix} ${guidance}`.trim();

  return {
    id: `missing-root:${diag.code}`,
    severity: diag.severity,
    title: 'Add the root instruction file',
    body,
    primaryAction: action('copy-template', 'Copy template'),
    secondaryActions: [action('open-docs', 'Open docs')],
  };
}

function buildMissingCwdStep(): NextStep {
  return {
    id: 'missing-cwd',
    severity: 'warning',
    title: 'Set the current directory (cwd)',
    body: 'Ancestor scans depend on where the tool runs. Set cwd so we load the right instructions.',
    primaryAction: action('set-cwd', 'Set cwd'),
  };
}

function buildOverrideWithoutBaseStep(diag: InstructionDiagnostic): NextStep {
  const detail = diag.expectedPath ? ` Expected: ${diag.expectedPath}.` : '';
  return {
    id: `override-without-base:${diag.path ?? 'unknown'}`,
    severity: diag.severity,
    title: 'Add a base file for overrides',
    body: `Overrides replace a base file in the same folder. Add the base file so the override is valid.${detail}`,
    primaryAction: action('copy-base-template', 'Copy base template'),
  };
}

function buildMixedToolsStep(hasExtraFiles: boolean): NextStep {
  return {
    id: 'mixed-tools',
    severity: 'warning',
    title: 'Multiple tool formats detected',
    body: 'You may be scanning the wrong tool or have extra files for other CLIs.',
    primaryAction: action('switch-tool', 'Switch tool'),
    secondaryActions: hasExtraFiles ? [action('review-extra-files', 'Review extra files')] : undefined,
  };
}

function formatDiagnosticBody(diag: InstructionDiagnostic): string {
  const parts = [diag.message];
  if (diag.suggestion) {
    parts.push(diag.suggestion);
  } else if (diag.expectedPath) {
    parts.push(`Expected: ${diag.expectedPath}.`);
  }
  return parts.join(' ');
}

function buildDiagnosticStep(diag: InstructionDiagnostic, hasExtraFiles: boolean): NextStep {
  if (diag.code === 'missing-cwd') {
    return buildMissingCwdStep();
  }
  if (diag.code === 'override-without-base') {
    return buildOverrideWithoutBaseStep(diag);
  }
  if (diag.code === 'mixed-tools') {
    return buildMixedToolsStep(hasExtraFiles);
  }
  if (missingRootCodes.has(diag.code)) {
    return buildMissingRootStep(diag);
  }
  if (diag.code.startsWith('case-mismatch.')) {
    return {
      id: `case-mismatch:${diag.path ?? diag.code}`,
      severity: diag.severity,
      title: 'Fix file casing',
      body: formatDiagnosticBody(diag),
    };
  }
  if (diag.code.startsWith('wrong-folder.')) {
    return {
      id: `wrong-folder:${diag.code}`,
      severity: diag.severity,
      title: 'Move instructions to the expected folder',
      body: formatDiagnosticBody(diag),
      primaryAction: action('open-docs', 'Open docs'),
    };
  }
  if (diag.code.startsWith('wrong-extension.')) {
    return {
      id: `wrong-extension:${diag.code}`,
      severity: diag.severity,
      title: 'Rename instruction files',
      body: formatDiagnosticBody(diag),
      primaryAction: action('open-docs', 'Open docs'),
    };
  }

  return {
    id: `diagnostic:${diag.code}`,
    severity: diag.severity,
    title: 'Resolve instruction issue',
    body: formatDiagnosticBody(diag),
  };
}

function buildWarningStep(warning: SimulationWarning, repoSource: RepoSource): NextStep {
  if (warning.code === 'scan-risk.large-tree') {
    const primary = repoSource === 'folder'
      ? action('scan-smaller-folder', 'Scan a smaller folder')
      : action('paste-paths', 'Paste repo paths');
    const secondary = repoSource === 'folder'
      ? action('paste-paths', 'Paste repo paths')
      : action('scan-smaller-folder', 'Scan a smaller folder');
    return {
      id: `warning:${warning.code}`,
      severity: 'warning',
      title: 'Limit the scan scope',
      body: `${warning.message} Large repos can bloat context. Consider scanning a narrower folder.`,
      primaryAction: primary,
      secondaryActions: [secondary],
    };
  }

  if (warning.code === 'scan-risk.cursor-rules') {
    return {
      id: `warning:${warning.code}`,
      severity: 'warning',
      title: 'Review cursor rules',
      body: warning.message,
    };
  }

  return {
    id: `warning:${warning.code}`,
    severity: 'warning',
    title: 'Review scan warning',
    body: warning.message,
  };
}

function buildMissingPatternsStep(insights: SimulatorInsights): NextStep {
  const patterns = insights.missingFiles.map((item) => item.pattern);
  const preview = patterns.slice(0, 3);
  const remaining = patterns.length - preview.length;
  const list = preview.join(', ');
  const suffix = remaining > 0 ? ` and ${remaining} more` : '';

  return {
    id: 'missing-patterns',
    severity: 'info',
    title: 'Review expected instruction locations',
    body: `This tool looks for instruction files in: ${list}${suffix}. Add them if needed.`,
    primaryAction: action('open-docs', 'Open docs'),
  };
}

export function computeNextSteps(input: NextStepsInput): NextStep[] {
  if (input.repoFileCount === 0 && !input.scanError) {
    return [buildNoScanStep(input.repoSource)];
  }

  const errorSteps: NextStep[] = [];
  const warningSteps: NextStep[] = [];
  const infoSteps: NextStep[] = [];

  if (input.scanError) {
    errorSteps.push(buildScanErrorStep(input.scanError, input.repoSource));
  }

  if (input.truncated) {
    warningSteps.push(buildTruncatedStep(input.repoSource));
  }

  for (const diag of input.diagnostics.diagnostics) {
    const step = buildDiagnosticStep(diag, input.extraFiles.length > 0);
    if (diag.severity === 'error') {
      errorSteps.push(step);
    } else if (diag.severity === 'warning') {
      warningSteps.push(step);
    } else {
      infoSteps.push(step);
    }
  }

  for (const warning of input.warnings) {
    warningSteps.push(buildWarningStep(warning, input.repoSource));
  }

  const hasMissingDiagnostic = input.diagnostics.diagnostics.some((diag) => diag.code.startsWith('missing.'));
  if (!hasMissingDiagnostic && input.insights.missingFiles.length > 0) {
    infoSteps.push(buildMissingPatternsStep(input.insights));
  }

  const steps: NextStep[] = [];
  if (input.isStale) {
    steps.push(buildStaleStep());
  }

  steps.push(...errorSteps, ...warningSteps, ...infoSteps);
  const isValid = !input.isStale && errorSteps.length === 0 && warningSteps.length === 0;
  if (isValid) {
    steps.push(buildReadyStep());
  }
  return steps;
}
