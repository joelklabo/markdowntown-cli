import type { SimulatorToolId } from '@/lib/atlas/simulators/types';

type SearchParamValue = string | string[] | undefined;
export type WorkbenchSearchParams = Record<string, SearchParamValue>;
export type ScanContext = {
  tool: SimulatorToolId;
  cwd: string;
  paths: string[];
};

function firstString(value: SearchParamValue): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

const SCAN_TOOL_IDS: SimulatorToolId[] = [
  'github-copilot',
  'copilot-cli',
  'claude-code',
  'gemini-cli',
  'codex-cli',
];

export function parseScanContext(searchParams: WorkbenchSearchParams): ScanContext | null {
  const tool = firstString(searchParams.scanTool)?.trim();
  if (!tool || !SCAN_TOOL_IDS.includes(tool as SimulatorToolId)) return null;
  const cwd = firstString(searchParams.scanCwd)?.trim() ?? '';
  const rawPaths = firstString(searchParams.scanPaths);
  let paths: string[] = [];
  if (rawPaths) {
    try {
      const parsed = JSON.parse(rawPaths);
      if (Array.isArray(parsed)) {
        paths = parsed.map((value) => String(value)).filter(Boolean).slice(0, 200);
      }
    } catch {
      paths = [];
    }
  }

  return {
    tool: tool as SimulatorToolId,
    cwd,
    paths,
  };
}
