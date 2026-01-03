"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Heading } from "@/components/ui/Heading";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { TextArea } from "@/components/ui/TextArea";
import { FileTree } from "@/components/ui/FileTree";
import { InstructionContentLint } from "@/components/atlas/InstructionContentLint";
import { InstructionHealthPanel } from "@/components/atlas/InstructionHealthPanel";
import { NextStepsPanel } from "@/components/atlas/NextStepsPanel";
import { SimulatorInsights } from "@/components/atlas/SimulatorInsights";
import { SimulatorScanMeta, shouldVirtualizeScanTree } from "@/components/atlas/SimulatorScanMeta";
import { VirtualizedFileTree } from "@/components/atlas/VirtualizedFileTree";
import { CopyButton } from "@/components/atlas/CopyButton";
import { lintInstructionContent } from "@/lib/atlas/simulators/contentLint";
import { DEFAULT_MAX_CONTENT_BYTES } from "@/lib/atlas/simulators/contentScan";
import { detectTool } from "@/lib/atlas/simulators/detectTool";
import { computeInstructionDiagnostics } from "@/lib/atlas/simulators/diagnostics";
import { computeSimulatorInsights } from "@/lib/atlas/simulators/insights";
import { computeNextSteps } from "@/lib/atlas/simulators/nextSteps";
import { simulateContextResolution } from "@/lib/atlas/simulators/simulate";
import type { FileSystemDirectoryHandleLike } from "@/lib/atlas/simulators/fsScan";
import { scanRepoTree } from "@/lib/atlas/simulators/fsScan";
import { scanFileList } from "@/lib/atlas/simulators/fileListScan";
import { scanZipFile, ZipScanError } from "@/lib/atlas/simulators/zipScan";
import { parseRepoInput, type RepoPathParseResult } from "@/lib/atlas/simulators/treeParse";
import type {
  ScanWorkerRequest,
  ScanWorkerResponse,
  SerializedError as ScanWorkerSerializedError,
} from "@/lib/atlas/simulators/workers/scanWorker";
import { INSTRUCTION_TEMPLATES } from "@/lib/atlas/simulators/templates";
import type { ToolRulesMetadataMap } from "@/lib/atlas/simulators/types";
import type {
  InstructionDiagnostics,
  NextStepAction,
  RepoScanMeta,
  RepoScanResult,
  RepoTree,
  SimulationResult,
  SimulatorInsights as SimulatorInsightsData,
  SimulatorToolId,
  ToolDetectionResult,
} from "@/lib/atlas/simulators/types";
import { initSessionStart, track, trackError } from "@/lib/analytics";
import { emitUiTelemetryEvent } from "@/lib/telemetry";
import { featureFlags } from "@/lib/flags";
import { persistScanContextForHandoff } from "@/hooks/useWorkbenchStore";

const TOOL_OPTIONS: Array<{ id: SimulatorToolId; label: string }> = [
  { id: "github-copilot", label: "GitHub Copilot" },
  { id: "copilot-cli", label: "Copilot CLI" },
  { id: "cursor", label: "Cursor" },
  { id: "claude-code", label: "Claude Code" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "codex-cli", label: "Codex CLI" },
];

const DEFAULT_REPO_TREE = [
  ".github/copilot-instructions.md",
  "CLAUDE.md",
  "GEMINI.md",
  "AGENTS.md",
  "AGENTS.override.md",
  ".cursor/rules/general.mdc",
].join("\n");

const SCAN_EXAMPLE_TREE = [
  ".github/copilot-instructions.md",
  ".github/instructions/*.instructions.md",
  ".github/agents/*.md",
  "AGENTS.md",
  "AGENTS.override.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".cursor/rules/*.mdc",
  ".cursorrules",
].join("\n");

const CLAUDE_ONLY_ALLOWLIST: RegExp[] = [/^CLAUDE\.md$/, /\/CLAUDE\.md$/];

const TREE_COMMANDS = [
  {
    id: "mac",
    label: "macOS / Linux",
    description: "Tree output (recommended)",
    command: 'tree -a -I ".git|node_modules" -F --noreport',
  },
  {
    id: "windows",
    label: "Windows (CMD)",
    description: "Tree output (ASCII)",
    command: "tree /f /a",
  },
  {
    id: "lsr",
    label: "Any POSIX shell",
    description: "Fallback (ls -R)",
    command: "ls -R",
  },
] as const;

class ScanWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanWorkerUnavailableError";
  }
}

class ScanWorkerFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanWorkerFailedError";
  }
}

type ScanWorkerPayload =
  | Omit<Extract<ScanWorkerRequest, { type: "scan_zip" }>, "id">
  | Omit<Extract<ScanWorkerRequest, { type: "scan_file_list" }>, "id">;

const createScanWorker = () => {
  if (typeof Worker === "undefined") {
    throw new ScanWorkerUnavailableError("Scan worker is not available in this browser.");
  }
  return new Worker(new URL("../../lib/atlas/simulators/workers/scanWorker.ts", import.meta.url), {
    type: "module",
  });
};

type RepoSignals = {
  hasGitHubCopilotRoot: boolean;
  hasGitHubCopilotScoped: boolean;
  hasCopilotCliScoped: boolean;
  hasCopilotAgents: boolean;
  hasAgentsAny: boolean;
  hasAgentsOverrideAny: boolean;
  hasClaudeAny: boolean;
  hasGeminiAny: boolean;
  hasCursorRules: boolean;
  hasCursorLegacy: boolean;
};

function toRepoTree(paths: string[]): RepoTree {
  return {
    files: paths.map((path) => ({ path, content: "" })),
  };
}

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized === ".") return "";
  return normalized;
}

function normalizePaths(paths: string[]): string[] {
  return paths.map((path) => normalizePath(path)).filter(Boolean);
}

function buildInputSignature(
  tool: SimulatorToolId,
  cwd: string,
  repoSource: "manual" | "folder",
  paths: string[],
): string {
  return JSON.stringify({
    tool,
    cwd: normalizePath(cwd),
    repoSource,
    paths: normalizePaths(paths),
  });
}

function isInstructionPath(path: string): boolean {
  if (!path) return false;
  if (path === ".github/copilot-instructions.md") return true;
  if (path.startsWith(".github/instructions/") && path.endsWith(".instructions.md")) return true;
  if (path.startsWith(".github/copilot-instructions/") && path.endsWith(".instructions.md")) return true;
  if (path.startsWith(".github/agents/")) return true;
  if (path === "AGENTS.md" || path.endsWith("/AGENTS.md")) return true;
  if (path === "AGENTS.override.md" || path.endsWith("/AGENTS.override.md")) return true;
  if (path === "CLAUDE.md" || path.endsWith("/CLAUDE.md")) return true;
  if (path === "GEMINI.md" || path.endsWith("/GEMINI.md")) return true;
  if (path.startsWith(".cursor/rules/")) return true;
  if (path === ".cursorrules") return true;
  return false;
}

function analyzeRepo(paths: string[]): RepoSignals {
  const signals: RepoSignals = {
    hasGitHubCopilotRoot: false,
    hasGitHubCopilotScoped: false,
    hasCopilotCliScoped: false,
    hasCopilotAgents: false,
    hasAgentsAny: false,
    hasAgentsOverrideAny: false,
    hasClaudeAny: false,
    hasGeminiAny: false,
    hasCursorRules: false,
    hasCursorLegacy: false,
  };

  for (const rawPath of paths) {
    const path = normalizePath(rawPath);
    if (!path) continue;
    if (path === ".github/copilot-instructions.md") {
      signals.hasGitHubCopilotRoot = true;
      continue;
    }
    if (path.startsWith(".github/instructions/") && path.endsWith(".instructions.md")) {
      signals.hasGitHubCopilotScoped = true;
      continue;
    }
    if (path.startsWith(".github/copilot-instructions/") && path.endsWith(".instructions.md")) {
      signals.hasCopilotCliScoped = true;
      continue;
    }
    if (path.startsWith(".github/agents/")) {
      signals.hasCopilotAgents = true;
      continue;
    }
    if (path === "AGENTS.md" || path.endsWith("/AGENTS.md")) {
      signals.hasAgentsAny = true;
      continue;
    }
    if (path === "AGENTS.override.md" || path.endsWith("/AGENTS.override.md")) {
      signals.hasAgentsOverrideAny = true;
      continue;
    }
    if (path === "CLAUDE.md" || path.endsWith("/CLAUDE.md")) {
      signals.hasClaudeAny = true;
      continue;
    }
    if (path === "GEMINI.md" || path.endsWith("/GEMINI.md")) {
      signals.hasGeminiAny = true;
      continue;
    }
    if (path.startsWith(".cursor/rules/")) {
      signals.hasCursorRules = true;
      continue;
    }
    if (path === ".cursorrules") {
      signals.hasCursorLegacy = true;
      continue;
    }
  }

  return signals;
}

const EMPTY_REPO_TREE: RepoTree = { files: [] };

function toolLabel(tool: SimulatorToolId): string {
  return TOOL_OPTIONS.find((option) => option.id === tool)?.label ?? tool;
}

function pickDeepestPath(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const normalized = paths.map((path) => normalizePath(path)).filter(Boolean);
  if (normalized.length === 0) return null;
  return normalized.sort((a, b) => {
    const depthDiff = b.split("/").length - a.split("/").length;
    return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
  })[0];
}

function suggestCwdFromDetection(detection: ToolDetectionResult): string {
  if (!detection.tool) return "";
  if (detection.tool === "github-copilot" || detection.tool === "copilot-cli") return "";
  const candidate = detection.candidates.find((item) => item.tool === detection.tool);
  const path = candidate ? pickDeepestPath(candidate.paths) : null;
  if (!path) return "";
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

const MAX_SCAN_PATHS = 200;
const MAX_SCAN_QUERY_BYTES = 1800;
const FALLBACK_QUERY_PATH_LIMITS = [50, 20, 0];

type WorkbenchHandoff = {
  href: string;
  notice?: string;
  mode: "url" | "storage" | "url-truncated" | "url-minimal";
};

function getByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function buildScanQuery(tool: SimulatorToolId, cwd: string, paths: string[]) {
  const params = new URLSearchParams();
  params.set("scanTool", tool);
  if (cwd) params.set("scanCwd", cwd);
  if (paths.length > 0) params.set("scanPaths", JSON.stringify(paths));
  const query = params.toString();
  return {
    href: query ? `/workbench?${query}` : "/workbench",
    query,
    byteLength: getByteLength(query),
  };
}

function buildFallbackWorkbenchHandoff(
  tool: SimulatorToolId,
  normalizedCwd: string,
  normalizedPaths: string[],
): WorkbenchHandoff {
  for (const limit of FALLBACK_QUERY_PATH_LIMITS) {
    const limitedPaths = normalizedPaths.slice(0, limit);
    const limitedQuery = buildScanQuery(tool, normalizedCwd, limitedPaths);
    if (limitedQuery.byteLength <= MAX_SCAN_QUERY_BYTES) {
      const notice =
        limit === 0
          ? "Scan context was too large to pass fully. Workbench will open with tool defaults only."
          : "Scan context was too large, so Workbench will load a shortened file preview.";
      return { href: limitedQuery.href, notice, mode: "url-truncated" };
    }
  }

  const minimalQuery = buildScanQuery(tool, "", []);
  if (minimalQuery.byteLength <= MAX_SCAN_QUERY_BYTES) {
    return {
      href: minimalQuery.href,
      notice: "Scan context was too large to pass. Workbench will open without scan defaults.",
      mode: "url-minimal",
    };
  }

  return {
    href: "/workbench",
    notice: "Scan context was too large to pass. Workbench will open without scan defaults.",
    mode: "url-minimal",
  };
}

function buildWorkbenchHandoff(tool: SimulatorToolId, cwd: string, paths: string[]): WorkbenchHandoff {
  const normalizedCwd = normalizePath(cwd);
  const normalizedPaths = Array.from(new Set(paths.map((path) => normalizePath(path)).filter(Boolean))).slice(
    0,
    MAX_SCAN_PATHS,
  );

  const baseQuery = buildScanQuery(tool, normalizedCwd, normalizedPaths);
  if (baseQuery.byteLength <= MAX_SCAN_QUERY_BYTES) {
    return { href: baseQuery.href, mode: "url" };
  }

  const storagePlan = persistScanContextForHandoff(
    { tool, cwd: normalizedCwd, paths: normalizedPaths },
    { dryRun: true },
  );
  if (storagePlan.status !== "failed") {
    const notice =
      storagePlan.status === "truncated"
        ? "This scan is large, so Workbench will load a shortened file preview. Scan a smaller folder for the full list."
        : "Large scan context saved for this session. If Workbench doesn’t load defaults, return and rescan.";
    return {
      href: "/workbench?scanStored=1",
      notice,
      mode: "storage",
    };
  }

  return buildFallbackWorkbenchHandoff(tool, normalizedCwd, normalizedPaths);
}

type SummaryInput = {
  tool: SimulatorToolId;
  cwd: string;
  repoSource: "manual" | "folder";
  result: SimulationResult;
  insights: SimulatorInsightsData;
  shadowed: SimulationResult["shadowed"];
  isStale: boolean;
};

function formatSummary({ tool, cwd, repoSource, result, insights, shadowed, isStale }: SummaryInput): string {
  const lines: string[] = [];
  lines.push(`Tool: ${toolLabel(tool)} (${tool})`);
  lines.push(`CWD: ${normalizePath(cwd) || "(repo root)"}`);
  lines.push(`Repo source: ${repoSource === "folder" ? "folder scan" : "manual paths"}`);

  if (isStale) {
    lines.push("Note: Results may be out of date. Re-run simulation for fresh results.");
  }

  lines.push("");
  lines.push("Loaded files:");
  if (result.loaded.length === 0) {
    lines.push("- (none)");
  } else {
    for (const file of result.loaded) {
      lines.push(`- ${file.path} — ${file.reason}`);
    }
  }

  lines.push("");
  lines.push("Missing instruction patterns:");
  if (insights.missingFiles.length === 0) {
    lines.push("- (none)");
  } else {
    for (const item of insights.missingFiles) {
      lines.push(`- ${item.label}: ${item.pattern}`);
    }
  }

  lines.push("");
  lines.push("Shadowed/overridden files:");
  if (shadowed.length === 0) {
    lines.push("- (none)");
  } else {
    for (const file of shadowed) {
      lines.push(`- ${file.path} — ${file.reason}`);
    }
  }

  lines.push("");
  lines.push("Warnings:");
  if (result.warnings.length === 0) {
    lines.push("- (none)");
  } else {
    for (const warning of result.warnings) {
      lines.push(`- ${warning.code}: ${warning.message}`);
    }
  }

  lines.push("");
  lines.push("Precedence notes:");
  if (insights.precedenceNotes.length === 0) {
    lines.push("- (none)");
  } else {
    for (const note of insights.precedenceNotes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}

type ReportInaccuracyInput = {
  tool: SimulatorToolId;
  repoSource: "manual" | "folder";
  result: SimulationResult;
  insights: SimulatorInsightsData;
  shadowed: SimulationResult["shadowed"];
  scanMeta?: RepoScanMeta | null;
  isStale: boolean;
};

function formatReportInaccuracy({
  tool,
  repoSource,
  result,
  insights,
  shadowed,
  scanMeta,
  isStale,
}: ReportInaccuracyInput): string {
  const lines: string[] = [];
  lines.push("Describe the mismatch (avoid repo paths or file contents).");
  lines.push("");
  lines.push(`Tool: ${toolLabel(tool)} (${tool})`);
  lines.push(`Repo source: ${repoSource === "folder" ? "folder scan" : "manual paths"}`);
  lines.push(`Loaded files: ${result.loaded.length}`);
  lines.push(`Missing patterns: ${insights.missingFiles.length}`);
  lines.push(`Shadowed files: ${shadowed.length}`);
  lines.push(`Warnings: ${result.warnings.length}`);

  const warningCodes = result.warnings.map((warning) => warning.code);
  if (warningCodes.length > 0) {
    lines.push(`Warning codes: ${warningCodes.join(", ")}`);
  }

  const missingPatterns = insights.missingFiles.map((item) => item.pattern);
  if (missingPatterns.length > 0) {
    const preview = missingPatterns.slice(0, 5).join(", ");
    const suffix = missingPatterns.length > 5 ? ", ..." : "";
    lines.push(`Missing patterns (examples): ${preview}${suffix}`);
  }

  if (scanMeta) {
    lines.push(`Total files scanned: ${scanMeta.totalFiles}`);
    lines.push(`Matched instruction files: ${scanMeta.matchedFiles}`);
    lines.push(`Scan truncated: ${scanMeta.truncated ? "yes" : "no"}`);
  } else {
    lines.push("Total files scanned: n/a");
    lines.push("Matched instruction files: n/a");
    lines.push("Scan truncated: n/a");
  }

  if (isStale) {
    lines.push("Results marked stale: yes");
  }

  lines.push("");
  lines.push("Thank you for helping us improve Atlas Simulator.");
  return lines.join("\n");
}

function buildReportInaccuracyHref(input: ReportInaccuracyInput): string {
  const title = `Atlas Simulator inaccuracy (${toolLabel(input.tool)})`;
  const body = formatReportInaccuracy(input);
  const params = new URLSearchParams({ title, body });
  return `https://github.com/joelklabo/markdowntown/issues/new?${params.toString()}`;
}

type FixSummaryInput = {
  tool: SimulatorToolId;
  cwd: string;
  diagnostics: InstructionDiagnostics;
  isStale: boolean;
};

function formatFixSummary({ tool, cwd, diagnostics, isStale }: FixSummaryInput): string {
  const lines: string[] = [];
  const errorCount = diagnostics.diagnostics.filter((item) => item.severity === "error").length;
  const warningCount = diagnostics.diagnostics.filter((item) => item.severity === "warning").length;
  const infoCount = diagnostics.diagnostics.filter((item) => item.severity === "info").length;
  const statusLabel = errorCount > 0 ? "Fail" : warningCount > 0 ? "Warn" : "Pass";

  lines.push(`Instruction health: ${toolLabel(tool)} (${tool})`);
  lines.push(`CWD: ${normalizePath(cwd) || "(repo root)"}`);
  if (isStale) {
    lines.push("Note: Results may be out of date. Re-run simulation for fresh results.");
  }
  lines.push(`Status: ${statusLabel}`);
  lines.push(`Counts: ${errorCount} error(s), ${warningCount} warning(s), ${infoCount} note(s)`);
  lines.push("");

  if (diagnostics.diagnostics.length === 0) {
    lines.push("No placement issues detected.");
    return lines.join("\n");
  }

  lines.push("Issues:");
  for (const issue of diagnostics.diagnostics) {
    lines.push(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
    if (issue.suggestion) {
      lines.push(`  Fix: ${issue.suggestion}`);
    } else if (issue.expectedPath) {
      lines.push(`  Expected: ${issue.expectedPath}`);
    }
  }

  return lines.join("\n");
}

type ContextSimulatorProps = {
  toolRulesMeta?: ToolRulesMetadataMap;
};

export function ContextSimulator({ toolRulesMeta }: ContextSimulatorProps) {
  const [tool, setTool] = useState<SimulatorToolId>("github-copilot");
  const [cwd, setCwd] = useState("");
  const [repoSource, setRepoSource] = useState<"manual" | "folder">("folder");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contentLintOptIn, setContentLintOptIn] = useState(false);
  const [repoText, setRepoText] = useState(DEFAULT_REPO_TREE);
  const [manualParse, setManualParse] = useState<RepoPathParseResult>(() => parseRepoInput(repoText));
  const [scannedTree, setScannedTree] = useState<RepoTree | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);
  const [toolDetection, setToolDetection] = useState<ToolDetectionResult | null>(null);
  const [scanMeta, setScanMeta] = useState<RepoScanMeta | null>(null);
  const [scanError, setScanError] = useState<{ message: string; kind: "permission-denied" | "not-found" | "generic" } | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<RepoScanMeta | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);
  const [result, setResult] = useState<SimulationResult>(() =>
    simulateContextResolution({ tool: "github-copilot", cwd: "", tree: EMPTY_REPO_TREE }),
  );
  const [insights, setInsights] = useState<SimulatorInsightsData>(() =>
    computeSimulatorInsights({ tool: "github-copilot", cwd: "", tree: EMPTY_REPO_TREE }),
  );
  const [instructionDiagnostics, setInstructionDiagnostics] = useState<InstructionDiagnostics>(() =>
    computeInstructionDiagnostics({ tool: "github-copilot", cwd: "", tree: EMPTY_REPO_TREE }),
  );
  const [lastSimulatedSignature, setLastSimulatedSignature] = useState(() =>
    buildInputSignature("github-copilot", "", "folder", []),
  );
  const [lastSimulatedPaths, setLastSimulatedPaths] = useState<string[]>(() => []);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [storageFallback, setStorageFallback] = useState<WorkbenchHandoff | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const parseWorkerRef = useRef<Worker | null>(null);
  const parseRequestIdRef = useRef(0);
  const [directorySupport, setDirectorySupport] = useState<"unknown" | "supported" | "unsupported">("unknown");
  const scanAbortRef = useRef<AbortController | null>(null);
  const scanIdRef = useRef(0);
  const directoryPickerActiveRef = useRef(false);

  const scanClarityEnabled = featureFlags.scanClarityV1;
  const quickUploadEnabled = featureFlags.scanQuickUploadV1;
  const canPickDirectory = directorySupport === "supported";
  const directorySupportKnown = directorySupport !== "unknown";
  const directorySupportMessage =
    canPickDirectory || !directorySupportKnown
      ? "Scans locally in your browser. File paths and contents never leave your device."
      : "File System Access API isn’t supported. Use the folder upload below; scans stay local and nothing is uploaded.";

  useEffect(() => {
    const supported = typeof window !== "undefined" && "showDirectoryPicker" in window;
    setDirectorySupport(supported ? "supported" : "unsupported");
  }, []);

  useEffect(() => {
    const { didStart } = initSessionStart();
    if (!didStart) return;
    emitUiTelemetryEvent({ name: "session_start" });
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    (window as unknown as { __atlasZipScan?: typeof scanZipFile }).__atlasZipScan = scanZipFile;
    return () => {
      delete (window as unknown as { __atlasZipScan?: typeof scanZipFile }).__atlasZipScan;
    };
  }, []);

  useEffect(() => {
    return () => {
      parseWorkerRef.current?.terminate();
      parseWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestId = ++parseRequestIdRef.current;
    const fallback = () => {
      if (requestId !== parseRequestIdRef.current) return;
      setManualParse(parseRepoInput(repoText));
    };

    let worker: Worker | null = null;
    try {
      if (!parseWorkerRef.current) {
        parseWorkerRef.current = createScanWorker();
      }
      worker = parseWorkerRef.current;
    } catch {
      fallback();
      return;
    }

    const handleMessage = (event: MessageEvent<ScanWorkerResponse>) => {
      const message = event.data;
      if (message.id !== requestId) return;
      if (message.type === "parse_tree_result") {
        setManualParse(message.result);
      } else if (message.type === "scan_error") {
        fallback();
      }
    };

    const handleError = () => fallback();

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    const request: ScanWorkerRequest = { id: requestId, type: "parse_tree", text: repoText };
    worker.postMessage(request);

    return () => {
      worker?.removeEventListener("message", handleMessage);
      worker?.removeEventListener("error", handleError);
    };
  }, [repoText]);

  const manualPaths = manualParse.paths;
  const manualIssues = manualParse.issues;
  const repoFileCount = repoSource === "folder" ? scannedTree?.files.length ?? 0 : manualPaths.length;
  const previewPaths = useMemo(
    () =>
      repoSource === "folder"
        ? (scannedTree?.files ?? []).map((file) => file.displayPath ?? file.path)
        : manualPaths,
    [manualPaths, repoSource, scannedTree],
  );
  const repoPaths = useMemo(
    () => (repoSource === "folder" ? (scannedTree?.files ?? []).map((file) => file.path) : manualPaths),
    [manualPaths, repoSource, scannedTree],
  );
  const showTreePreview = previewPaths.length > 0;
  const useVirtualizedTree = showTreePreview && shouldVirtualizeScanTree(previewPaths.length);
  const repoSignals = useMemo(() => analyzeRepo(repoPaths), [repoPaths]);

  useEffect(() => {
    setSelectedPreviewPath(null);
  }, [manualPaths.length, repoSource, scannedTree]);
  const currentSignature = useMemo(
    () => buildInputSignature(tool, cwd, repoSource, repoPaths),
    [cwd, repoPaths, repoSource, tool],
  );
  const isStale = currentSignature !== lastSimulatedSignature;
  const advancedOpen = showAdvanced || repoSource === "manual";
  const maxContentKb = Math.round(DEFAULT_MAX_CONTENT_BYTES / 1024);
  const includeClaudeContent = tool === "claude-code";
  const includeScanContent = contentLintOptIn || includeClaudeContent;
  const scanContentAllowlist = contentLintOptIn
    ? undefined
    : includeClaudeContent
      ? CLAUDE_ONLY_ALLOWLIST
      : undefined;
  const scanButtonLabel = isScanning ? "Scanning…" : isPickingDirectory ? "Picking folder…" : "Scan a folder";
  const zipButtonLabel = isScanning ? "Scanning…" : "Upload a ZIP";

  const scannedPreview = useMemo(() => {
    const paths = (scannedTree?.files ?? []).map((file) => file.displayPath ?? file.path);
    const limit = 200;
    const head = paths.slice(0, limit);
    const suffix = paths.length > limit ? `\n… (${paths.length - limit} more)` : "";
    return head.join("\n") + suffix;
  }, [scannedTree]);

  const emptyStateHint = useMemo(() => {
    if (repoSource === "folder" && !scannedTree) {
      return "Choose a folder to scan to see which instruction files load.";
    }

    if (repoSource === "manual" && manualPaths.length === 0) {
      return "Add repo paths above to simulate instruction loading.";
    }

    if (tool === "github-copilot") {
      if (!repoSignals.hasGitHubCopilotRoot && !repoSignals.hasGitHubCopilotScoped) {
        return repoSource === "manual"
          ? "No Copilot instruction files in the list. Add .github/copilot-instructions.md or .github/instructions/*.instructions.md."
          : "No Copilot instruction files found. Add .github/copilot-instructions.md or .github/instructions/*.instructions.md.";
      }
    }

    if (tool === "copilot-cli") {
      if (!repoSignals.hasGitHubCopilotRoot && !repoSignals.hasCopilotCliScoped && !repoSignals.hasCopilotAgents) {
        return repoSource === "manual"
          ? "No Copilot CLI instruction files in the list. Add .github/copilot-instructions.md, .github/copilot-instructions/**/*.instructions.md, or .github/agents/*."
          : "No Copilot CLI instruction files found. Add .github/copilot-instructions.md, .github/copilot-instructions/**/*.instructions.md, or .github/agents/*.";
      }
    }

    if (tool === "codex-cli") {
      if (!repoSignals.hasAgentsAny && !repoSignals.hasAgentsOverrideAny) {
        return repoSource === "manual"
          ? "No AGENTS.md files in the list. Add AGENTS.md or AGENTS.override.md."
          : "No AGENTS.md files found. Add AGENTS.md or AGENTS.override.md.";
      }
      if (!cwd) {
        return "Set cwd to a directory inside the repo so ancestor scans can find AGENTS.md.";
      }
    }

    if (tool === "claude-code") {
      if (!repoSignals.hasClaudeAny) {
        return repoSource === "manual" ? "No CLAUDE.md files in the list." : "No CLAUDE.md files found.";
      }
      if (!cwd) {
        return "Set cwd to a directory inside the repo so ancestor scans can find CLAUDE.md.";
      }
    }

    if (tool === "gemini-cli") {
      if (!repoSignals.hasGeminiAny) {
        return repoSource === "manual" ? "No GEMINI.md files in the list." : "No GEMINI.md files found.";
      }
      if (!cwd) {
        return "Set cwd to a directory inside the repo so ancestor scans can find GEMINI.md.";
      }
    }

    if (tool === "cursor") {
      if (!repoSignals.hasCursorRules && !repoSignals.hasCursorLegacy) {
        return repoSource === "manual"
          ? "No Cursor rule files in the list. Add .cursor/rules/*.mdc or .cursorrules."
          : "No Cursor rule files found. Add .cursor/rules/*.mdc or .cursorrules.";
      }
    }

    return "If you expected files, double-check the repo tree and current directory.";
  }, [cwd, manualPaths.length, repoSignals, repoSource, scannedTree, tool]);

  const shadowedFiles = result.shadowed;
  const detectionSummary = useMemo(() => {
    if (!toolDetection) return null;
    if (toolDetection.tool) {
      const candidate = toolDetection.candidates.find((item) => item.tool === toolDetection.tool);
      const otherTools = toolDetection.matchedTools.filter((item) => item !== toolDetection.tool);
      const mixedNote = toolDetection.isMixed
        ? otherTools.length > 0
          ? `Also found: ${otherTools.map((item) => toolLabel(item)).join(", ")}. Switch tools if needed.`
          : "Other tool instruction files were found—switch tools if you want a different scan."
        : null;
      return {
        title: `Detected: ${toolLabel(toolDetection.tool)}`,
        body: [
          candidate?.reason ? `${candidate.reason}.` : "Matched known instruction files.",
          mixedNote,
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
    if (toolDetection.isMixed) {
      const toolList = toolDetection.matchedTools.map((item) => toolLabel(item)).join(", ");
      return {
        title: "Multiple tool formats detected",
        body: toolList
          ? `Found instruction files for ${toolList}. Choose the tool you want to validate.`
          : "Found instruction files for more than one tool. Choose the tool you want to validate.",
      };
    }
    return {
      title: "No instruction files detected yet",
      body: "Pick a tool or paste paths to continue.",
    };
  }, [toolDetection]);
  const scanCounts = useMemo(() => {
    const foundCount = insights.foundFiles.length;
    const missingCount = insights.missingFiles.length;
    const foundLabel = `${foundCount} file${foundCount === 1 ? "" : "s"} found`;
    const missingLabel = `${missingCount} missing`;
    return `${foundLabel} · ${missingLabel}`;
  }, [insights.foundFiles.length, insights.missingFiles.length]);
  const scanProgressLabel = useMemo(() => {
    if (!scanProgress) return "";
    const scannedLabel = `${scanProgress.totalFiles} file${scanProgress.totalFiles === 1 ? "" : "s"} scanned`;
    const matchedLabel = scanProgress.matchedFiles > 0 ? `, ${scanProgress.matchedFiles} matched` : "";
    return `${scannedLabel}${matchedLabel}.`;
  }, [scanProgress]);
  const showQuickSummary = quickUploadEnabled && repoSource === "folder" && repoFileCount > 0;
  const detectedInstructionPaths = useMemo(
    () => lastSimulatedPaths.filter((path) => isInstructionPath(path)),
    [lastSimulatedPaths],
  );
  const workbenchHandoff = useMemo(
    () => buildWorkbenchHandoff(tool, cwd, detectedInstructionPaths),
    [cwd, detectedInstructionPaths, tool],
  );
  useEffect(() => {
    setStorageFallback(null);
  }, [workbenchHandoff.href, workbenchHandoff.mode, workbenchHandoff.notice]);

  useEffect(() => {
    if (workbenchHandoff.mode !== "storage") return;
    const result = persistScanContextForHandoff({ tool, cwd, paths: detectedInstructionPaths });
    if (result.status === "failed") {
      setStorageFallback(
        buildFallbackWorkbenchHandoff(tool, normalizePath(cwd), normalizePaths(detectedInstructionPaths)),
      );
    }
  }, [workbenchHandoff.mode, tool, cwd, detectedInstructionPaths]);

  const resolvedWorkbenchHandoff = storageFallback ?? workbenchHandoff;
  const workbenchHref = resolvedWorkbenchHandoff.href;
  const handoffNotice = resolvedWorkbenchHandoff.notice;
  const fixSummaryText = useMemo(
    () => formatFixSummary({ tool, cwd, diagnostics: instructionDiagnostics, isStale }),
    [cwd, instructionDiagnostics, isStale, tool],
  );
  const resultsSummary = useMemo(() => {
    if (scanError) {
      return `${scanError.message} Use Next steps to recover.`;
    }
    if (result.loaded.length === 0) {
      return "No instruction files would load yet. Start with Next steps. Scans stay local.";
    }
    if (scanMeta?.truncated) {
      return "Scan truncated. Results may be incomplete—consider narrowing the folder. Scans stay local.";
    }
    if (insights.missingFiles.length === 0 && result.warnings.length === 0) {
      return "All expected instruction files were found. Open Workbench to build and export agents.md. Scans stay local.";
    }
    if (insights.missingFiles.length > 0) {
      return "Missing instruction files. Add the files or copy a template, then rescan. Scans stay local.";
    }
    if (result.warnings.length > 0) {
      return "Warnings detected. Review them before exporting. Scans stay local.";
    }
    return "Review the results and move on when ready. Scans stay local.";
  }, [insights.missingFiles.length, result.loaded.length, result.warnings.length, scanError, scanMeta?.truncated]);
  const contentLintResult = useMemo(() => {
    if (!contentLintOptIn || repoSource !== "folder") return null;
    return lintInstructionContent(scannedTree ?? { files: [] });
  }, [contentLintOptIn, repoSource, scannedTree]);
  const nextSteps = useMemo(
    () =>
      computeNextSteps({
        tool,
        repoSource,
        repoFileCount,
        isStale,
        diagnostics: instructionDiagnostics,
        warnings: result.warnings,
        insights,
        extraFiles: shadowedFiles.map((file) => file.path),
        scanError: scanError?.kind ?? null,
        truncated: scanMeta?.truncated ?? false,
      }),
    [
      shadowedFiles,
      instructionDiagnostics,
      insights,
      isStale,
      repoFileCount,
      repoSource,
      result.warnings,
      scanError,
      scanMeta?.truncated,
      tool,
    ],
  );
  const hasNextStepsOpenWorkbench = useMemo(
    () => nextSteps.some((step) => step.primaryAction?.id === "open-workbench"),
    [nextSteps],
  );
  const nextStepsSummary = useMemo(() => {
    if (scanError) {
      return "Scan failed. Choose a different folder or paste paths to continue. Files stay local.";
    }
    if (hasNextStepsOpenWorkbench && insights.missingFiles.length === 0 && result.warnings.length === 0) {
      return "You're ready. Open Workbench to build and export agents.md. Files stay local.";
    }
    const loadedCount = result.loaded.length;
    const missingCount = insights.missingFiles.length;
    const warningCount = result.warnings.length;
    const loadedLabel = `${loadedCount} loaded file${loadedCount === 1 ? "" : "s"}`;
    const missingLabel = `${missingCount} missing pattern${missingCount === 1 ? "" : "s"}`;
    const warningLabel = `${warningCount} warning${warningCount === 1 ? "" : "s"}`;
    return `Scan summary: ${loadedLabel}, ${missingLabel}, ${warningLabel}. Start with the top fix. Files stay local.`;
  }, [hasNextStepsOpenWorkbench, insights.missingFiles.length, result.loaded.length, result.warnings.length, scanError]);
  const showSummaryWorkbench =
    lastSimulatedPaths.length > 0 && (!featureFlags.scanNextStepsV1 || !hasNextStepsOpenWorkbench);
  const reportInaccuracyHref = useMemo(
    () =>
      buildReportInaccuracyHref({
        tool,
        repoSource,
        result,
        insights,
        shadowed: shadowedFiles,
        scanMeta,
        isStale,
      }),
    [tool, repoSource, result, insights, shadowedFiles, scanMeta, isStale],
  );

  const announceStatus = (message: string) => {
    setActionStatus(message);
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => setActionStatus(null), 3000);
  };

  const copyToClipboard = async (text: string, successMessage: string, errorMessage: string) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      announceStatus(successMessage);
      return null;
    } catch (err) {
      announceStatus(errorMessage);
      return err instanceof Error ? err : new Error("Copy failed");
    }
  };

  const scrollToElement = (id: string, focus = false) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focus && "focus" in element) {
      (element as HTMLElement).focus();
    }
  };

  const openAdvancedField = (id: string) => {
    setShowAdvanced(true);
    window.setTimeout(() => scrollToElement(id, true), 50);
  };

  const runSimulationWithTree = (
    tree: RepoTree,
    sourcePaths: string[],
    source: "manual" | "folder",
    trigger: "manual" | "scan",
    overrides?: { tool?: SimulatorToolId; cwd?: string },
  ) => {
    const normalizedPaths = normalizePaths(sourcePaths);
    const nextTool = overrides?.tool ?? tool;
    const nextCwd = overrides?.cwd ?? cwd;
    const nextResult = simulateContextResolution({ tool: nextTool, cwd: nextCwd, tree });
    const nextInsights = computeSimulatorInsights({ tool: nextTool, cwd: nextCwd, tree });
    const nextDiagnostics = computeInstructionDiagnostics({ tool: nextTool, cwd: nextCwd, tree });
    const errorCount = nextDiagnostics.diagnostics.filter((item) => item.severity === "error").length;
    const warningCount = nextDiagnostics.diagnostics.filter((item) => item.severity === "warning").length;
    const infoCount = nextDiagnostics.diagnostics.filter((item) => item.severity === "info").length;
    setResult(nextResult);
    setInsights(nextInsights);
    setInstructionDiagnostics(nextDiagnostics);
    setTool(nextTool);
    setCwd(nextCwd);
    setLastSimulatedSignature(buildInputSignature(nextTool, nextCwd, source, normalizedPaths));
    setLastSimulatedPaths(normalizedPaths);
    setRepoSource(source);
    setShowAdvanced(source === "manual");
    track("atlas_simulator_simulate", {
      tool: nextTool,
      repoSource: source,
      trigger,
      cwd: normalizePath(nextCwd) || undefined,
      fileCount: normalizedPaths.length,
    });
    if (featureFlags.instructionHealthV1) {
      track("atlas_simulator_health_check", {
        tool: nextTool,
        repoSource: source,
        trigger,
        cwd: normalizePath(nextCwd) || undefined,
        fileCount: normalizedPaths.length,
        issueCount: nextDiagnostics.diagnostics.length,
        errorCount,
        warningCount,
        infoCount,
      });
    }
  };

  const refreshResults = (shouldAnnounce = false) => {
    const tree = repoSource === "folder" ? scannedTree ?? { files: [] } : toRepoTree(manualPaths);
    const sourcePaths =
      repoSource === "folder"
        ? (scannedTree?.files ?? []).map((file) => file.path)
        : manualPaths;
    runSimulationWithTree(tree, sourcePaths, repoSource, "manual");
    if (shouldAnnounce) {
      announceStatus("Results refreshed.");
    }
  };

  const applyToolDetection = (paths: string[]) => {
    if (!quickUploadEnabled) return {};
    const detection = detectTool(paths);
    setToolDetection(detection);
    if (detection.tool && detection.confidence !== "low") {
      return {
        tool: detection.tool,
        cwd: suggestCwdFromDetection(detection),
      };
    }
    return {};
  };

  const trackScanError = (
    error: unknown,
    context: { method: string; tool: SimulatorToolId; cwd?: string },
  ) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    track("atlas_simulator_scan_error", { ...context, errorName });
  };

  const formatScanErrorMessage = (error: unknown) => {
    if (error instanceof ZipScanError) {
      return {
        message: error.message,
        kind: "generic" as const,
      };
    }
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        return {
          message: "Permission denied. Check folder access and try again. Files stay local.",
          kind: "permission-denied" as const,
        };
      }
      if (error.name === "NotFoundError") {
        return {
          message: "Folder not found. Choose a different folder and try again. Files stay local.",
          kind: "not-found" as const,
        };
      }
    }
    return {
      message: "Unable to scan folder. Check permissions and try again. Files stay local.",
      kind: "generic" as const,
    };
  };

  const deserializeWorkerError = (error: ScanWorkerSerializedError) => {
    if (error.kind) {
      return new ZipScanError(error.kind as ZipScanError["kind"], error.message);
    }
    if (error.name) {
      return new DOMException(error.message, error.name);
    }
    return new Error(error.message);
  };

  const runScanWorker = async (
    payload: ScanWorkerPayload,
    signal: AbortSignal | undefined,
    onProgress: (progress: { totalFiles: number; matchedFiles: number }) => void,
  ) => {
    const worker = createScanWorker();
    const requestId = 1;

    return new Promise<RepoScanResult>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        worker.terminate();
        signal?.removeEventListener("abort", handleAbort);
      };

      const handleAbort = () => {
        cleanup();
        reject(new DOMException("Scan aborted", "AbortError"));
      };

      if (signal?.aborted) {
        handleAbort();
        return;
      }

      signal?.addEventListener("abort", handleAbort, { once: true });

      worker.onmessage = (event) => {
        const message = event.data as ScanWorkerResponse;
        if (message.id !== requestId) return;
        if (message.type === "scan_progress") {
          onProgress(message.progress);
          return;
        }
        if (message.type === "scan_error") {
          cleanup();
          reject(deserializeWorkerError(message.error));
          return;
        }
        if (message.type === "scan_result") {
          cleanup();
          resolve(message.result);
        }
      };

      worker.onerror = () => {
        cleanup();
        reject(new ScanWorkerFailedError("Scan worker failed to respond."));
      };

      const request: ScanWorkerRequest =
        payload.type === "scan_zip"
          ? { id: requestId, type: "scan_zip", file: payload.file, options: payload.options }
          : { id: requestId, type: "scan_file_list", files: payload.files, options: payload.options };
      worker.postMessage(request);
    });
  };

  const scanWithWorkerFallback = async (
    payload: ScanWorkerPayload,
    fallback: () => Promise<RepoScanResult>,
    signal: AbortSignal | undefined,
    onProgress: (progress: { totalFiles: number; matchedFiles: number }) => void,
  ) => {
    try {
      return await runScanWorker(payload, signal, onProgress);
    } catch (error) {
      if (error instanceof ScanWorkerUnavailableError || error instanceof ScanWorkerFailedError) {
        setScanNotice("Scan worker unavailable. Scanning on the main thread.");
        return fallback();
      }
      throw error;
    }
  };

  const runFolderScan = async (
    method: "directory_picker" | "file_input" | "zip_upload",
    scan: (signal: AbortSignal, onProgress: (progress: { totalFiles: number; matchedFiles: number }) => void) => Promise<{
      tree: RepoTree;
      totalFiles: number;
      matchedFiles: number;
      truncated: boolean;
    }>,
    rootName?: string,
  ) => {
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;
    scanIdRef.current += 1;
    const scanId = scanIdRef.current;
    setScanError(null);
    setScanNotice(null);
    setIsScanning(true);
    setScanProgress({ totalFiles: 0, matchedFiles: 0, truncated: false });
    const scanCwd = normalizePath(cwd) || undefined;
    track("atlas_simulator_scan_start", { method, tool, cwd: scanCwd });
    emitUiTelemetryEvent({
      name: "scan_start",
      properties: { method, tool, cwd: scanCwd },
    });
    try {
      const { tree, totalFiles, matchedFiles, truncated } = await scan(controller.signal, (progress) => {
        if (scanId !== scanIdRef.current) return;
        setScanProgress({ totalFiles: progress.totalFiles, matchedFiles: progress.matchedFiles, truncated: false });
      });
      if (scanId !== scanIdRef.current) return;
      const resolvedRootName = rootName;
      setScannedTree(tree);
      setScanMeta({
        totalFiles,
        matchedFiles,
        truncated,
        rootName: resolvedRootName,
      });
      const paths = tree.files.map((file) => file.path);
      const overrides = applyToolDetection(paths);
      const nextTool = overrides.tool ?? tool;
      const nextCwd = normalizePath(overrides.cwd ?? cwd) || undefined;
      runSimulationWithTree(tree, paths, "folder", "scan", overrides);
      track("atlas_simulator_scan_complete", {
        method,
        tool: nextTool,
        cwd: nextCwd,
        totalFiles,
        matchedFiles,
        truncated,
        rootName: resolvedRootName,
      });
      emitUiTelemetryEvent({
        name: "scan_complete",
        properties: {
          method,
          tool: nextTool,
          cwd: nextCwd,
          totalFiles,
          matchedFiles,
          truncated,
        },
      });
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        track("atlas_simulator_scan_cancel", { method, tool, cwd: scanCwd });
        emitUiTelemetryEvent({
          name: "scan_cancel",
          properties: { method, tool, cwd: scanCwd },
        });
        setScanNotice("Scan canceled. Scan a folder to continue.");
        return;
      }
      trackScanError(err, { method, tool, cwd: scanCwd });
      setScanError(formatScanErrorMessage(err));
    } finally {
      if (scanId !== scanIdRef.current) return;
      setIsScanning(false);
      setScanProgress(null);
      scanAbortRef.current = null;
    }
  };

  const scanFileListWithWorker = async (
    files: FileList,
    signal: AbortSignal,
    onProgress: (progress: { totalFiles: number; matchedFiles: number }) => void,
  ) => {
    const options = {
      includeContent: includeScanContent,
      contentAllowlist: scanContentAllowlist,
    };
    const fallback = () =>
      scanFileList(files, {
        ...options,
        signal,
        onProgress,
      });
    return scanWithWorkerFallback(
      { type: "scan_file_list", files: Array.from(files), options },
      fallback,
      signal,
      onProgress,
    );
  };

  const scanZipWithWorker = async (
    zipFile: File,
    signal: AbortSignal,
    onProgress: (progress: { totalFiles: number; matchedFiles: number }) => void,
  ) => {
    const options = {
      includeContent: includeScanContent,
      contentAllowlist: scanContentAllowlist,
    };
    const fallback = () =>
      scanZipFile(zipFile, {
        ...options,
        signal,
        onProgress,
      });
    return scanWithWorkerFallback({ type: "scan_zip", file: zipFile, options }, fallback, signal, onProgress);
  };

  const handleDirectoryPickerScan = async () => {
    if (directoryPickerActiveRef.current || isPickingDirectory) {
      setScanNotice("Folder picker is already open. Finish or cancel to continue.");
      return;
    }
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;
    if (!picker) {
      setScanError({
        message: "File System Access API not available. Paste paths instead. Files stay local.",
        kind: "generic",
      });
      return;
    }
    setScanError(null);
    setScanNotice(null);
    directoryPickerActiveRef.current = true;
    setIsPickingDirectory(true);
    try {
      const handle = await picker();
      const rootName = (handle as { name?: string }).name;
      await runFolderScan(
        "directory_picker",
        (signal, onProgress) =>
          scanRepoTree(handle as FileSystemDirectoryHandleLike, {
            includeContent: includeScanContent,
            contentAllowlist: scanContentAllowlist,
            signal,
            onProgress,
          }),
        rootName,
      );
    } catch (err) {
      const scanCwd = normalizePath(cwd) || undefined;
      if (err instanceof DOMException && err.name === "AbortError") {
        track("atlas_simulator_scan_cancel", { method: "directory_picker", tool, cwd: scanCwd });
        emitUiTelemetryEvent({
          name: "scan_cancel",
          properties: { method: "directory_picker", tool, cwd: scanCwd },
        });
        setScanNotice("Scan canceled. Scan a folder to continue.");
        return;
      }
      if (err instanceof DOMException && (err.name === "InvalidStateError" || err.message.includes("picker already"))) {
        setScanNotice("Folder picker is already open. Finish or cancel to continue.");
        return;
      }
      trackScanError(err, { method: "directory_picker", tool, cwd: scanCwd });
      setScanError(formatScanErrorMessage(err));
    } finally {
      directoryPickerActiveRef.current = false;
      setIsPickingDirectory(false);
    }
  };

  const handleFileInputScan = async (files: FileList | null) => {
    setScanError(null);
    if (!files || files.length === 0) {
      setScanNotice("Scan canceled. Scan a folder to continue.");
      const scanCwd = normalizePath(cwd) || undefined;
      track("atlas_simulator_scan_cancel", { method: "file_input", tool, cwd: scanCwd });
      emitUiTelemetryEvent({
        name: "scan_cancel",
        properties: { method: "file_input", tool, cwd: scanCwd },
      });
      return;
    }
    const rootName = files[0]?.webkitRelativePath?.split("/")[0];
    await runFolderScan(
      "file_input",
      (signal, onProgress) => scanFileListWithWorker(files, signal, onProgress),
      rootName,
    );
  };

  const handleZipInputScan = async (files: FileList | null) => {
    setScanError(null);
    if (!files || files.length === 0) {
      setScanNotice("ZIP upload canceled. Upload a ZIP to continue.");
      const scanCwd = normalizePath(cwd) || undefined;
      track("atlas_simulator_scan_cancel", { method: "zip_upload", tool, cwd: scanCwd });
      emitUiTelemetryEvent({
        name: "scan_cancel",
        properties: { method: "zip_upload", tool, cwd: scanCwd },
      });
      return;
    }
    const zipFile = files[0];
    if (!zipFile) return;
    const rootName = zipFile.name.replace(/\.zip$/i, "") || zipFile.name;
    await runFolderScan(
      "zip_upload",
      (signal, onProgress) => scanZipWithWorker(zipFile, signal, onProgress),
      rootName,
    );
  };

  const handleOpenDocs = () => {
    const docsUrl = "/docs";
    const opened = window.open(docsUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = docsUrl;
    }
    announceStatus("Opening docs.");
  };

  const handleCopySummary = async () => {
    const summary = formatSummary({
      tool,
      cwd,
      repoSource,
      result,
      insights,
      shadowed: shadowedFiles,
      isStale,
    });
    const copyError = await copyToClipboard(
      summary,
      "Summary copied to clipboard.",
      "Unable to copy summary.",
    );
    if (!copyError) {
      track("atlas_simulator_copy_summary", {
        tool,
        repoSource,
        fileCount: lastSimulatedPaths.length,
      });
    } else {
      trackError("atlas_simulator_copy_error", copyError, { tool, repoSource });
    }
  };

  const handleDownloadReport = () => {
    const summary = formatSummary({
      tool,
      cwd,
      repoSource,
      result,
      insights,
      shadowed: shadowedFiles,
      isStale,
    });
    try {
      const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `atlas-simulator-${tool}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      announceStatus("Report downloaded.");
      track("atlas_simulator_download_report", {
        tool,
        repoSource,
        fileCount: lastSimulatedPaths.length,
      });
    } catch (err) {
      announceStatus("Unable to download report.");
      if (err instanceof Error) {
        trackError("atlas_simulator_download_error", err, { tool, repoSource });
      }
    }
  };

  const handleReportInaccuracy = () => {
    track("atlas_simulator_report_inaccuracy", {
      tool,
      repoSource,
      fileCount: lastSimulatedPaths.length,
      missingCount: insights.missingFiles.length,
      warningCount: result.warnings.length,
      shadowedCount: shadowedFiles.length,
      truncated: scanMeta?.truncated ?? false,
    });
  };

  const handleOpenWorkbenchCta = (source: "post_scan" | "actions" | "next_steps") => {
    emitUiTelemetryEvent({
      name: "scan_results_cta",
      properties: {
        source,
        tool,
        repoSource,
        loaded: result.loaded.length,
        missing: insights.missingFiles.length,
        truncated: scanMeta?.truncated ?? false,
        fileCount: lastSimulatedPaths.length,
      },
    });
  };

  const handleNextStepAction = async (action: NextStepAction, stepId: string) => {
    emitUiTelemetryEvent({
      name: "scan_next_step_click",
      properties: {
        actionId: action.id,
        stepId,
        tool,
        repoSource,
        isStale,
        fileCount: lastSimulatedPaths.length,
        truncated: scanMeta?.truncated ?? false,
        source: "next_steps",
      },
    });
    track("atlas_simulator_next_step_action", {
      tool,
      repoSource,
      cwd: normalizePath(cwd) || undefined,
      actionId: action.id,
      stepId,
      isStale,
      fileCount: lastSimulatedPaths.length,
    });

    if (action.id === "copy-summary") {
      await handleCopySummary();
      return;
    }

    if (action.id === "download-report") {
      handleDownloadReport();
      return;
    }

    if (action.id === "refresh-results") {
      refreshResults(true);
      return;
    }

    if (action.id === "open-workbench") {
      handleOpenWorkbenchCta("next_steps");
      window.location.assign(workbenchHref);
      return;
    }

    if (action.id === "scan-folder") {
      announceStatus("Choose a folder to scan.");
      if (canPickDirectory) {
        await handleDirectoryPickerScan();
      } else {
        fileInputRef.current?.click();
      }
      return;
    }

    if (action.id === "scan-smaller-folder") {
      announceStatus("Pick a smaller folder to scan.");
      if (canPickDirectory) {
        await handleDirectoryPickerScan();
      } else {
        fileInputRef.current?.click();
      }
      return;
    }

    if (action.id === "paste-paths") {
      setRepoSource("manual");
      setShowAdvanced(true);
      requestAnimationFrame(() => scrollToElement("sim-tree-manual", true));
      announceStatus("Paste repo paths to simulate.");
      return;
    }

    if (action.id === "set-cwd") {
      openAdvancedField("sim-cwd");
      announceStatus("Set the current directory to continue.");
      return;
    }

    if (action.id === "switch-tool") {
      openAdvancedField("sim-tool");
      announceStatus("Choose the tool you want to simulate.");
      return;
    }

    if (action.id === "review-extra-files") {
      scrollToElement("sim-insights");
      announceStatus("Review extra instruction files below.");
      return;
    }

    if (action.id === "open-docs") {
      handleOpenDocs();
      return;
    }

    if (action.id === "copy-template" || action.id === "copy-base-template") {
      const template = INSTRUCTION_TEMPLATES[tool]?.root;
      if (!template) {
        announceStatus("No template available for this tool.");
        return;
      }
      const copyError = await copyToClipboard(
        template.content,
        `Copied ${template.path} template.`,
        "Unable to copy template.",
      );
      if (copyError) {
        trackError("atlas_simulator_next_step_template_error", copyError, {
          tool,
          repoSource,
          templateId: template.id,
          templatePath: template.path,
        });
      } else {
        track("atlas_simulator_next_step_template_copy", {
          tool,
          repoSource,
          templateId: template.id,
          templatePath: template.path,
          actionId: action.id,
          stepId,
        });
      }
      return;
    }

    announceStatus("Action not available yet.");
  };

  return (
    <div className="grid gap-mdt-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:gap-mdt-8">
      <Card padding="lg">
        <Stack gap={5}>
          <Stack gap={1}>
            <Heading level="h2">Scan setup</Heading>
            {scanClarityEnabled ? (
              <Text tone="muted">
                Scan a folder to see which instruction files load. Scans stay local in your browser.
              </Text>
            ) : null}
          </Stack>
          {scanClarityEnabled ? (
            <Stack gap={2}>
              <Stack as="ol" gap={1} className="list-decimal pl-mdt-5 text-body-sm text-mdt-muted">
                <li>
                  <span className="font-semibold text-mdt-text">Choose a tool.</span>{" "}
                  {quickUploadEnabled
                    ? "Scan first and adjust the tool afterward if needed."
                    : "Pick the agent or CLI you want to validate."}
                </li>
                <li>
                  <span className="font-semibold text-mdt-text">Set your working directory (cwd).</span> Use your repo
                  root (`.`) unless you need a subfolder.
                </li>
                <li>
                  <span className="font-semibold text-mdt-text">Scan a folder.</span> We’ll show what loads, what’s
                  missing, and what to fix next.
                </li>
              </Stack>
              <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                <Text size="bodySm" weight="semibold">
                  Local-only scan
                </Text>
                <Text size="bodySm" tone="muted">
                  Files are scanned in your browser. Nothing is uploaded.
                </Text>
              </div>
              <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                <Text size="bodySm" weight="semibold">
                  Quick start
                </Text>
                <Text size="bodySm" tone="muted">
                  {quickUploadEnabled
                    ? "Click “Scan a folder”, then adjust tool or cwd in Advanced if needed."
                    : "Choose a tool, set cwd to your repo root (`.`), and scan."}
                </Text>
              </div>
            </Stack>
          ) : null}

          {quickUploadEnabled ? (
            <div className="space-y-mdt-4">
              <div className="space-y-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
                <Text
                  as="label"
                  htmlFor="sim-folder-upload"
                  size="caption"
                  weight="semibold"
                  tone="muted"
                  className="uppercase tracking-wide"
                >
                  Scan a folder
                </Text>
                <Text tone="muted" size="bodySm">
                  {directorySupportMessage}
                </Text>
                <div className="flex flex-wrap gap-mdt-2">
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={isScanning || isPickingDirectory}
                    onClick={() => {
                      if (canPickDirectory) {
                        void handleDirectoryPickerScan();
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    {scanButtonLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={isScanning || isPickingDirectory}
                    onClick={() => zipInputRef.current?.click()}
                  >
                    {zipButtonLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setRepoSource("manual");
                      openAdvancedField("sim-tree-manual");
                    }}
                  >
                    Paste paths
                  </Button>
                </div>
                <Input
                  ref={fileInputRef}
                  id="sim-folder-upload"
                  name="sim-folder-upload"
                  type="file"
                  multiple
                  className={canPickDirectory ? "sr-only" : undefined}
                  // @ts-expect-error - non-standard attribute for directory uploads
                  webkitdirectory="true"
                  aria-label="Upload folder"
                  onChange={async (event) => {
                    await handleFileInputScan(event.target.files);
                  }}
                />
                <Input
                  ref={zipInputRef}
                  id="sim-zip-upload"
                  name="sim-zip-upload"
                  type="file"
                  accept=".zip,application/zip"
                  className="sr-only"
                  aria-label="Upload ZIP"
                  onChange={async (event) => {
                    await handleZipInputScan(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />

                {isScanning ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text size="bodySm" weight="semibold">
                      Scanning…
                    </Text>
                    <Text tone="muted" size="bodySm">
                      {scanProgressLabel || "Reading files from your folder."}
                    </Text>
                  </div>
                ) : null}

                {scanError ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption text-[color:var(--mdt-color-danger)]">
                    {scanError.message}
                  </div>
                ) : null}
                {scanNotice ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption text-mdt-muted">
                    {scanNotice}
                  </div>
                ) : null}
                {handoffNotice ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption text-mdt-muted">
                    {handoffNotice}
                  </div>
                ) : null}

                {showQuickSummary ? (
                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text size="bodySm" weight="semibold">
                      {detectionSummary?.title ?? `Detected: ${toolLabel(tool)}`}
                    </Text>
                    {scanMeta ? (
                      <SimulatorScanMeta {...scanMeta} tool={tool} toolRulesMeta={toolRulesMeta} />
                    ) : (
                      <Text tone="muted" size="bodySm">
                        {scanCounts}
                      </Text>
                    )}
                    {detectionSummary?.body ? (
                      <Text tone="muted" size="bodySm">
                        {detectionSummary.body}
                      </Text>
                    ) : null}
                    <div className="flex flex-wrap gap-mdt-2">
                      <Button type="button" variant="secondary" onClick={() => openAdvancedField("sim-tool")}>
                        Change tool
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => openAdvancedField("sim-cwd")}>
                        Change cwd
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <details
                className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3"
                open={advancedOpen}
                onToggle={(event) => setShowAdvanced((event.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer text-body-sm font-semibold text-mdt-text">
                  Show advanced settings
                </summary>
                <div className="mt-mdt-3 space-y-mdt-3">
                  <fieldset className="space-y-mdt-3 border-0 p-0">
                    <legend className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
                      Scan inputs
                    </legend>
                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <label htmlFor="sim-tool" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
                      Tool
                    </label>
                    <Select
                      id="sim-tool"
                      name="sim-tool"
                      value={tool}
                      onChange={(e) => setTool(e.target.value as SimulatorToolId)}
                    >
                      {TOOL_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <label htmlFor="sim-cwd" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
                      Current directory (cwd)
                    </label>
                    <Input
                      id="sim-cwd"
                      name="sim-cwd"
                      placeholder="e.g. src/app"
                      value={cwd}
                      onChange={(e) => setCwd(e.target.value)}
                    />
                    <Text tone="muted" size="bodySm">
                      Used for tools that scan parent directories (e.g., `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`).
                    </Text>
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text
                      as="h4"
                      id="sim-tree-preview-label"
                      size="caption"
                      weight="semibold"
                      tone="muted"
                      className="uppercase tracking-wide"
                    >
                      Scan preview
                    </Text>
                    {scanMeta ? (
                      <SimulatorScanMeta {...scanMeta} tool={tool} toolRulesMeta={toolRulesMeta} />
                    ) : null}
                    {showTreePreview ? (
                      useVirtualizedTree ? (
                        <VirtualizedFileTree
                          paths={previewPaths}
                          selectedPath={selectedPreviewPath}
                          onSelect={setSelectedPreviewPath}
                          height={320}
                          ariaLabel="Scanned paths preview"
                        />
                      ) : (
                        <div className="max-h-80 overflow-auto rounded-mdt-md border border-mdt-border bg-mdt-surface">
                          <FileTree
                            paths={previewPaths}
                            selectedPath={selectedPreviewPath}
                            onSelect={setSelectedPreviewPath}
                            className="px-2 py-2"
                            emptyLabel="Scanned paths will appear here."
                          />
                        </div>
                      )
                    ) : (
                      <TextArea
                        id="sim-tree-preview"
                        name="sim-tree-preview"
                        rows={8}
                        value={scannedPreview}
                        readOnly
                        placeholder="Scanned paths will appear here."
                        aria-labelledby="sim-tree-preview-label"
                      />
                    )}
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                      Optional: content linting
                    </Text>
                    <Text tone="muted" size="bodySm">
                      Opt in to read instruction file contents locally for linting. Contents never leave your device.
                    </Text>
                    <Checkbox
                      id="sim-content-linting"
                      name="sim-content-linting"
                      checked={contentLintOptIn}
                      onChange={(event) => setContentLintOptIn(event.target.checked)}
                    >
                      Enable content linting (local-only)
                    </Checkbox>
                    <Text tone="muted" size="bodySm">
                      Only instruction files are read. Files larger than {maxContentKb} KB are skipped.
                    </Text>
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text
                      as="h4"
                      id="sim-tree-manual-label"
                      size="caption"
                      weight="semibold"
                      tone="muted"
                      className="uppercase tracking-wide"
                    >
                      Paste repo paths
                    </Text>
                    <Text tone="muted" size="bodySm">
                      Use this when you can’t scan a folder. One path per line.
                    </Text>
                    <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                      <Text as="h5" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                        Copy a tree command
                      </Text>
                      <Text tone="muted" size="bodySm">
                        Run the command in your repo root, then paste the output below.
                      </Text>
                      <div className="space-y-mdt-2">
                        {TREE_COMMANDS.map((command) => (
                          <div
                            key={command.id}
                            className="flex flex-wrap items-center justify-between gap-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-2 py-mdt-2"
                          >
                            <div className="space-y-1">
                              <Text size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                                {command.label}
                              </Text>
                              <Text tone="muted" size="bodySm">
                                {command.description}
                              </Text>
                              <pre className="whitespace-pre-wrap rounded-mdt-sm border border-mdt-border bg-mdt-surface-subtle px-mdt-2 py-mdt-1 text-body-xs text-mdt-text">
                                {command.command}
                              </pre>
                            </div>
                            <CopyButton
                              text={command.command}
                              label="Copy command"
                              copiedLabel="Copied"
                              size="xs"
                              variant="secondary"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <TextArea
                      id="sim-tree-manual"
                      name="sim-tree-manual"
                      rows={8}
                      value={repoText}
                      onChange={(e) => {
                        if (repoSource !== "manual") setRepoSource("manual");
                        setShowAdvanced(true);
                        setRepoText(e.target.value);
                      }}
                      placeholder="One path per line (e.g. .github/copilot-instructions.md)"
                      aria-labelledby="sim-tree-manual-label"
                    />
                    {manualIssues.length > 0 ? (
                      <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                        <Text size="bodySm" weight="semibold" className="text-[color:var(--mdt-color-danger)]">
                          Fix these lines before you run the scan
                        </Text>
                        <ul
                          aria-label="Repo path parse errors"
                          className="mt-mdt-2 space-y-mdt-1 text-caption text-[color:var(--mdt-color-danger)]"
                        >
                          {manualIssues.map((issue) => (
                            <li key={`${issue.line}-${issue.text}`}>
                              Line {issue.line}: {issue.message}{" "}
                              <code className="rounded-mdt-xs bg-mdt-surface-subtle px-1 font-mono">
                                {issue.text}
                              </code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <Text tone="muted" size="bodySm">
                    {repoFileCount} file(s) in the current source. Lines starting with `#` or `//` are ignored.
                    {manualIssues.length > 0 ? ` ${manualIssues.length} line(s) need attention.` : ""}
                  </Text>
                  </fieldset>
                </div>
              </details>

            </div>
          ) : (
            <div className="space-y-mdt-4">
              <div className="space-y-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
                {canPickDirectory ? (
                  <Text as="p" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                    Scan a folder
                  </Text>
                ) : (
                  <label htmlFor="sim-folder-scan" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
                    Scan a folder
                  </label>
                )}
                <Text tone="muted" size="bodySm">{directorySupportMessage}</Text>
                <div className="flex flex-wrap gap-mdt-2">
                  {canPickDirectory ? (
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      disabled={isScanning || isPickingDirectory}
                      onClick={() => {
                        void handleDirectoryPickerScan();
                      }}
                    >
                      {scanButtonLabel}
                    </Button>
                  ) : (
                    <Input
                      ref={fileInputRef}
                      id="sim-folder-scan"
                      name="sim-folder-scan"
                      type="file"
                      multiple
                      // @ts-expect-error - non-standard attribute for directory uploads
                      webkitdirectory="true"
                      aria-label="Upload folder"
                      onChange={async (event) => {
                        await handleFileInputScan(event.target.files);
                      }}
                    />
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={isScanning || isPickingDirectory}
                    onClick={() => zipInputRef.current?.click()}
                  >
                    {zipButtonLabel}
                  </Button>
                </div>
                <Input
                  ref={zipInputRef}
                  id="sim-zip-upload-alt"
                  name="sim-zip-upload-alt"
                  type="file"
                  accept=".zip,application/zip"
                  className="sr-only"
                  aria-label="Upload ZIP"
                  onChange={async (event) => {
                    await handleZipInputScan(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                  <Text size="bodySm" weight="semibold">
                    Local-only scan
                  </Text>
                  <Text tone="muted" size="bodySm">
                    Files are scanned in your browser. Nothing is uploaded.
                  </Text>
                </div>

                {isScanning ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text size="bodySm" weight="semibold">
                      Scanning…
                    </Text>
                    <Text tone="muted" size="bodySm">
                      {scanProgressLabel || "Reading files from your folder."}
                    </Text>
                  </div>
                ) : null}

                {scanError ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption text-[color:var(--mdt-color-danger)]">
                    {scanError.message}
                  </div>
                ) : null}
                {scanNotice ? (
                  <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption text-mdt-muted">
                    {scanNotice}
                  </div>
                ) : null}

                {scanMeta ? <SimulatorScanMeta {...scanMeta} tool={tool} toolRulesMeta={toolRulesMeta} /> : null}
              </div>

              <details
                className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3"
                open={advancedOpen}
                onToggle={(event) => setShowAdvanced((event.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer text-body-sm font-semibold text-mdt-text">
                  Show advanced settings
                </summary>
                <div className="mt-mdt-3 space-y-mdt-3">
                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <label htmlFor="sim-tool" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
                      Tool
                    </label>
                    <Select
                      id="sim-tool"
                      name="sim-tool"
                      value={tool}
                      onChange={(e) => setTool(e.target.value as SimulatorToolId)}
                    >
                      {TOOL_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <label htmlFor="sim-cwd" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
                      Current directory (cwd)
                    </label>
                    <Input
                      id="sim-cwd"
                      name="sim-cwd"
                      placeholder="e.g. src/app"
                      value={cwd}
                      onChange={(e) => setCwd(e.target.value)}
                    />
                    <Text tone="muted" size="bodySm">
                      Used for tools that scan parent directories (e.g., `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`).
                    </Text>
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                      Scan preview
                    </Text>
                    {showTreePreview ? (
                      useVirtualizedTree ? (
                        <VirtualizedFileTree
                          paths={previewPaths}
                          selectedPath={selectedPreviewPath}
                          onSelect={setSelectedPreviewPath}
                          height={320}
                          ariaLabel="Scanned paths preview"
                        />
                      ) : (
                        <div className="max-h-80 overflow-auto rounded-mdt-md border border-mdt-border bg-mdt-surface">
                          <FileTree
                            paths={previewPaths}
                            selectedPath={selectedPreviewPath}
                            onSelect={setSelectedPreviewPath}
                            className="px-2 py-2"
                            emptyLabel="Scanned paths will appear here."
                          />
                        </div>
                      )
                    ) : (
                      <TextArea
                        id="sim-tree-preview"
                        name="sim-tree-preview"
                        rows={8}
                        value={scannedPreview}
                        readOnly
                        placeholder="Scanned paths will appear here."
                        aria-label="Scanned paths preview"
                      />
                    )}
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                      Optional: content linting
                    </Text>
                    <Text tone="muted" size="bodySm">
                      Opt in to read instruction file contents locally for linting. Contents never leave your device.
                    </Text>
                    <Checkbox
                      id="sim-content-linting"
                      name="sim-content-linting"
                      checked={contentLintOptIn}
                      onChange={(event) => setContentLintOptIn(event.target.checked)}
                    >
                      Enable content linting (local-only)
                    </Checkbox>
                    <Text tone="muted" size="bodySm">
                      Only instruction files are read. Files larger than {maxContentKb} KB are skipped.
                    </Text>
                  </div>

                  <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                      Paste repo paths
                    </Text>
                    <Text tone="muted" size="bodySm">
                      Use this when you can’t scan a folder. One path per line.
                    </Text>
                    <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                      <Text as="h5" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                        Copy a tree command
                      </Text>
                      <Text tone="muted" size="bodySm">
                        Run the command in your repo root, then paste the output below.
                      </Text>
                      <div className="space-y-mdt-2">
                        {TREE_COMMANDS.map((command) => (
                          <div
                            key={command.id}
                            className="flex flex-wrap items-center justify-between gap-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-2 py-mdt-2"
                          >
                            <div className="space-y-1">
                              <Text size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                                {command.label}
                              </Text>
                              <Text tone="muted" size="bodySm">
                                {command.description}
                              </Text>
                              <pre className="whitespace-pre-wrap rounded-mdt-sm border border-mdt-border bg-mdt-surface-subtle px-mdt-2 py-mdt-1 text-body-xs text-mdt-text">
                                {command.command}
                              </pre>
                            </div>
                            <CopyButton
                              text={command.command}
                              label="Copy command"
                              copiedLabel="Copied"
                              size="xs"
                              variant="secondary"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <TextArea
                      id="sim-tree-manual"
                      name="sim-tree-manual"
                      rows={8}
                      value={repoText}
                      onChange={(e) => {
                        if (repoSource !== "manual") setRepoSource("manual");
                        setShowAdvanced(true);
                        setRepoText(e.target.value);
                      }}
                      placeholder="One path per line (e.g. .github/copilot-instructions.md)"
                    />
                    {manualIssues.length > 0 ? (
                      <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                        <Text size="bodySm" weight="semibold" className="text-[color:var(--mdt-color-danger)]">
                          Fix these lines before you run the scan
                        </Text>
                        <ul
                          aria-label="Repo path parse errors"
                          className="mt-mdt-2 space-y-mdt-1 text-caption text-[color:var(--mdt-color-danger)]"
                        >
                          {manualIssues.map((issue) => (
                            <li key={`${issue.line}-${issue.text}`}>
                              Line {issue.line}: {issue.message}{" "}
                              <code className="rounded-mdt-xs bg-mdt-surface-subtle px-1 font-mono">
                                {issue.text}
                              </code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <Text tone="muted" size="bodySm">
                    {repoFileCount} file(s) in the current source. Lines starting with `#` or `//` are ignored.
                    {manualIssues.length > 0 ? ` ${manualIssues.length} line(s) need attention.` : ""}
                  </Text>
                </div>
              </details>
            </div>
          )}

          {scanClarityEnabled ? (
            <div className="space-y-mdt-2 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                What we scan
              </Text>
              <Text tone="muted" size="bodySm">
                We look for instruction files in root and tool-specific locations. Add or rename files to be loaded.
              </Text>
              <ul className="list-disc space-y-mdt-1 pl-mdt-5 text-body-sm text-mdt-muted">
                <li>Root instructions (e.g., AGENTS.md, CLAUDE.md, GEMINI.md)</li>
                <li>Tool configs (e.g., .github/copilot-instructions.md, .windsurfrules)</li>
                <li>Agent folders (e.g., .github/, .cursor/, .codex/)</li>
              </ul>
              <details className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                <summary className="cursor-pointer text-body-sm font-semibold text-mdt-text">View example tree</summary>
                <pre className="mt-mdt-2 whitespace-pre-wrap rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-body-xs text-mdt-muted">
                  {SCAN_EXAMPLE_TREE}
                </pre>
              </details>
            </div>
          ) : null}

          {!quickUploadEnabled || isStale ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => refreshResults()}
            >
              Refresh results
            </Button>
          ) : null}
        </Stack>
      </Card>

      <Card padding="lg">
        <Stack gap={5}>
          <Stack gap={2}>
            <Heading level="h2">Results</Heading>
            <Text tone="muted">Start with Next steps. Then review the summary and files below.</Text>
            {isStale ? (
              <div
                className="flex flex-wrap items-center justify-between gap-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-caption text-mdt-muted"
                role="status"
              >
                <span>Results are out of date. Refresh results to update.</span>
                <Button type="button" size="xs" variant="secondary" onClick={() => refreshResults()}>
                  Refresh results
                </Button>
              </div>
            ) : null}
          </Stack>

          <div className="space-y-mdt-4">
            <div className="space-y-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                Summary
              </Text>
              <div className="flex flex-wrap items-center gap-mdt-2">
                <Badge tone={result.loaded.length === 0 ? "warning" : "success"}>
                  Loaded files {result.loaded.length}
                </Badge>
                <Badge tone={insights.missingFiles.length > 0 ? "warning" : "success"}>
                  Missing files {insights.missingFiles.length}
                </Badge>
                <Badge tone={shadowedFiles.length > 0 ? "info" : "success"}>
                  Shadowed {shadowedFiles.length}
                </Badge>
                <Badge tone={result.warnings.length > 0 ? "warning" : "success"}>
                  Warnings {result.warnings.length}
                </Badge>
                {scanMeta?.truncated ? <Badge tone="warning">Scan truncated</Badge> : null}
              </div>
              <Text size="bodySm" tone="muted">
                {resultsSummary}
              </Text>
              <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                Quick actions
              </Text>
              <div className="flex flex-wrap gap-mdt-2">
                {showSummaryWorkbench ? (
                  <Button type="button" asChild variant="primary">
                    <Link href={workbenchHref} onClick={() => handleOpenWorkbenchCta("actions")}>
                      Open Workbench
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" onClick={handleCopySummary}>
                  Copy summary
                </Button>
                <Button type="button" variant="secondary" onClick={handleDownloadReport}>
                  Download report
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-mdt-2 text-caption text-mdt-muted">
                <Text as="span" size="caption" tone="muted">
                  Results look off?
                </Text>
                <Button type="button" variant="ghost" size="xs" asChild>
                  <a
                    href={reportInaccuracyHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleReportInaccuracy}
                  >
                    Report inaccuracy
                  </a>
                </Button>
              </div>
              {actionStatus ? (
                <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption text-mdt-muted" role="status" aria-live="polite">
                  {actionStatus}
                </div>
              ) : null}
            </div>
            {featureFlags.scanNextStepsV1 ? (
              <NextStepsPanel
                steps={nextSteps}
                subtitle={nextStepsSummary}
                className="border-mdt-border-strong bg-mdt-surface-raised shadow-mdt-lg"
                onAction={(action, step) => {
                  void handleNextStepAction(action, step.id);
                }}
              />
            ) : null}
            {featureFlags.instructionHealthV1 ? (
              <InstructionHealthPanel
                diagnostics={instructionDiagnostics}
                copySummaryText={fixSummaryText}
                workbenchHref={workbenchHref}
              />
            ) : null}
            {featureFlags.instructionHealthV1 ? (
              <InstructionContentLint enabled={contentLintOptIn} result={contentLintResult} />
            ) : null}

            <div className="space-y-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                Loaded files
              </Text>
              <ul className="space-y-mdt-2" aria-label="Loaded files">
                {result.loaded.length === 0 ? (
                  <li className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                    <Stack gap={1}>
                      <Text tone="muted" size="bodySm">No files would be loaded for this input.</Text>
                      {emptyStateHint ? (
                        <Text tone="muted" size="bodySm">
                          {emptyStateHint}
                        </Text>
                      ) : null}
                    </Stack>
                  </li>
                ) : (
                  result.loaded.map((file) => (
                    <li key={file.path} className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                      <div className="font-mono text-body-sm text-mdt-text">{file.path}</div>
                      <div className="text-body-xs text-mdt-muted">{file.reason}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="space-y-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
                Warnings
              </Text>
              {result.warnings.length === 0 ? (
                <Text tone="muted" size="bodySm">No warnings.</Text>
              ) : (
                <ul className="space-y-mdt-2" aria-label="Warnings">
                  {result.warnings.map((warning) => (
                    <li key={warning.code} className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
                      <div className="flex flex-wrap items-center gap-mdt-2">
                        <Badge tone="warning">Warning</Badge>
                        <div className="text-body-sm font-semibold text-mdt-text">{warning.code}</div>
                      </div>
                      <div className="text-body-xs text-mdt-muted">{warning.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div id="sim-insights">
              <SimulatorInsights insights={insights} shadowedFiles={shadowedFiles} />
            </div>
          </div>
        </Stack>
      </Card>
    </div>
  );
}
