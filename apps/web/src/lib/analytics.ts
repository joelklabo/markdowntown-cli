/**
 * Lightweight PostHog wrapper used in client components.
 * Safe to call in SSR/ISR contexts; no-ops when posthog is unavailable.
 */
const REDACT_KEYS = new Set([
  "content",
  "contents",
  "cwd",
  "paths",
  "filepaths",
  "filepath",
  "filelist",
  "files",
  "filename",
  "rootname",
  "repo",
  "repository",
  "templatepath",
  "expectedpath",
  "instructionpath",
  "scanpath",
  "absolute_path",
  "absolutepath",
  "url",
  "tree",
  "repotree",
  "repopaths",
  "sourcepaths",
  "scannedpaths",
  "scannedtree",
]);

type AnalyticsRecord = Record<string, unknown>;

const SESSION_START_STORAGE_KEY = "mdt_session_start_ms";
const SESSION_START_TTL_MS = 30 * 60 * 1000;

export function redactAnalyticsPayload(properties?: AnalyticsRecord): AnalyticsRecord | undefined {
  if (!properties) return properties;
  return redactObject(properties);
}

function redactObject(input: AnalyticsRecord): AnalyticsRecord {
  const output: AnalyticsRecord = {};
  for (const [key, value] of Object.entries(input)) {
    if (shouldRedactKey(key)) continue;
    const nextValue = redactValue(value);
    if (nextValue !== undefined) output[key] = nextValue;
  }
  return output;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (isRecord(entry)) return redactObject(entry);
      return entry;
    });
  }
  if (isRecord(value)) {
    return redactObject(value);
  }
  return value;
}

function shouldRedactKey(key: string) {
  return REDACT_KEYS.has(key.toLowerCase());
}

function isRecord(value: unknown): value is AnalyticsRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSessionStartMs(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_START_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionStartMs(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_START_STORAGE_KEY, String(value));
  } catch {
    // ignore storage errors
  }
}

export function initSessionStart(): { startMs: number | null; didStart: boolean } {
  if (typeof window === "undefined") return { startMs: null, didStart: false };
  const now = Date.now();
  const existing = readSessionStartMs();
  if (existing && now - existing < SESSION_START_TTL_MS) {
    return { startMs: existing, didStart: false };
  }

  writeSessionStartMs(now);
  const stored = readSessionStartMs();
  if (!stored) return { startMs: null, didStart: false };
  return { startMs: stored, didStart: stored === now };
}

export function getTimeSinceSessionStartMs(): number | undefined {
  const startMs = readSessionStartMs();
  if (!startMs) return undefined;
  const delta = Date.now() - startMs;
  if (!Number.isFinite(delta) || delta < 0) return undefined;
  return Math.round(delta);
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const ph = (window as unknown as { posthog?: { capture: (e: string, p?: Record<string, unknown>) => void } }).posthog;
    ph?.capture?.(event, redactAnalyticsPayload(properties));
  } catch {
    // swallow analytics errors to avoid UI impact
  }
}

function withPageContext(properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return properties;
  return {
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    ...properties,
  };
}

export function trackUiEvent(event: string, properties?: Record<string, unknown>) {
  track(event, withPageContext(properties));
}

export function trackHomeCtaClick(properties: {
  cta: string;
  href: string;
  placement: string;
  slot?: string;
}) {
  trackUiEvent("ui_home_cta_click", properties);
}

export function trackError(event: string, error: Error, properties?: Record<string, unknown>) {
  track(event, {
    message: error.message,
    stack: error.stack,
    ...properties,
  });
}

export function trackSkillsListView(properties: {
  count: number;
  q?: string;
  tags?: string[];
  targets?: string[];
  sort?: string;
}) {
  trackUiEvent("skills_list_view", properties);
}

export function trackSkillDetailView(properties: {
  id: string;
  slug?: string;
  title?: string;
  targets?: string[];
  capabilityCount?: number;
}) {
  trackUiEvent("skills_detail_view", properties);
}

export function trackSkillOpenWorkbench(properties: {
  id: string;
  slug?: string;
  title?: string;
  source: string;
}) {
  trackUiEvent("skills_open_workbench", properties);
}

export function trackSkillExportConfig(properties: {
  targetId: string;
  mode: string;
  allowListCount: number;
  totalSkills: number;
}) {
  trackUiEvent("skills_export_config", properties);
}

export function trackSkillExportAction(properties: {
  action: "download" | "copy";
  targetIds?: string[];
  targetId?: string;
  path?: string;
  skillCount: number;
  entrySource?: string;
}) {
  trackUiEvent("skills_export_action", properties);
}

export function trackSkillWorkbenchEdit(properties: {
  action: "add" | "remove" | "select" | "update";
  id?: string;
  field?: string;
}) {
  trackUiEvent("skills_workbench_edit", properties);
}

export function trackTranslateStart(properties: {
  targetIds: string[];
  targetCount: number;
  inputChars: number;
  detectedLabel?: string;
}) {
  trackUiEvent("translate_start", properties);
}

export function trackTranslateComplete(properties: {
  targetIds: string[];
  targetCount: number;
  inputChars: number;
  fileCount: number;
  warningCount?: number;
  infoCount?: number;
}) {
  trackUiEvent("translate_complete", properties);
}

export function trackTranslateDownload(properties: {
  targetIds: string[];
  targetCount: number;
  fileCount: number;
  byteSize: number;
}) {
  trackUiEvent("translate_download", properties);
}

export function trackTranslateOpenWorkbench(properties: {
  targetIds: string[];
  targetCount: number;
  fileCount: number;
}) {
  trackUiEvent("translate_open_workbench", properties);
}

export function trackTranslateError(
  error: Error,
  properties: {
    targetIds: string[];
    targetCount: number;
    inputChars: number;
    detectedLabel?: string;
    reason?: string;
  }
) {
  trackError("translate_error", error, properties);
}

export function trackLibraryAction(properties: {
  action: "open_workbench" | "copy" | "download" | "fork";
  id: string;
  slug?: string;
  title?: string;
  source: string;
  targetIds?: string[];
}) {
  trackUiEvent("library_action", properties);
}
