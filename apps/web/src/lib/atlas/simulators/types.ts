export type SimulatorToolId =
  | 'github-copilot'
  | 'copilot-cli'
  | 'claude-code'
  | 'gemini-cli'
  | 'codex-cli'
  | 'cursor';

export type ToolRulesMetadata = {
  docUrl?: string;
  lastVerified?: string;
};

export type ToolRulesMetadataMap = Record<SimulatorToolId, ToolRulesMetadata>;

export type ToolDetectionConfidence = 'high' | 'medium' | 'low' | 'none';

export type ToolDetectionCandidate = {
  tool: SimulatorToolId;
  score: number;
  paths: string[];
  reason: string;
};

export type ToolDetectionResult = {
  tool: SimulatorToolId | null;
  confidence: ToolDetectionConfidence;
  candidates: ToolDetectionCandidate[];
  matchedTools: SimulatorToolId[];
  isMixed: boolean;
};

export type RepoTreeFile = {
  path: string;
  displayPath?: string;
  content: string;
  contentStatus?: "loaded" | "truncated" | "skipped";
  contentReason?: "not-allowlisted" | "too-large" | "unreadable" | "binary";
};

export type RepoTree = {
  files: RepoTreeFile[];
};

export type RepoScanMeta = {
  totalFiles: number;
  matchedFiles: number;
  truncated: boolean;
  rootName?: string;
};

export type RepoScanResult = RepoScanMeta & {
  tree: RepoTree;
};

export type SimulationInput = {
  tool: SimulatorToolId;
  tree: RepoTree;
  cwd: string;
};

export type LoadedFile = {
  path: string;
  reason: string;
};

export type SimulationWarning = {
  code: string;
  message: string;
};

export type ShadowedFile = {
  path: string;
  reason: string;
};

export type SimulationResult = {
  loaded: LoadedFile[];
  warnings: SimulationWarning[];
  shadowed: ShadowedFile[];
};

export type SimulatorInsightPattern = {
  id: string;
  label: string;
  pattern: string;
};

export type SimulatorInsights = {
  tool: SimulatorToolId;
  expectedPatterns: SimulatorInsightPattern[];
  foundFiles: string[];
  missingFiles: SimulatorInsightPattern[];
  precedenceNotes: string[];
};

export type InstructionDiagnosticSeverity = 'error' | 'warning' | 'info';

export type InstructionDiagnostic = {
  code: string;
  severity: InstructionDiagnosticSeverity;
  message: string;
  suggestion?: string;
  path?: string;
  expectedPath?: string;
};

export type InstructionDiagnostics = {
  tool: SimulatorToolId;
  diagnostics: InstructionDiagnostic[];
};

export type NextStepSeverity = 'error' | 'warning' | 'info' | 'ready';

export type NextStepActionId =
  | 'scan-folder'
  | 'paste-paths'
  | 'refresh-results'
  | 'copy-template'
  | 'open-docs'
  | 'open-workbench'
  | 'set-cwd'
  | 'copy-base-template'
  | 'switch-tool'
  | 'review-extra-files'
  | 'scan-smaller-folder'
  | 'copy-summary'
  | 'download-report';

export type NextStepAction = {
  id: NextStepActionId;
  label: string;
};

export type NextStep = {
  id: string;
  severity: NextStepSeverity;
  title: string;
  body: string;
  primaryAction?: NextStepAction;
  secondaryActions?: NextStepAction[];
};
