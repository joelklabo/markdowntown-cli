export type RepoPathParseIssue = {
  line: number;
  message: string;
  text: string;
};

export type RepoPathParseResult = {
  paths: string[];
  issues: RepoPathParseIssue[];
};

type TreeNode = {
  depth: number;
  name: string;
  line: number;
  isDirHint: boolean;
};

const TREE_MARKER_RE = /(?:├|└)[─-]{2,}|\+--|\\--|\|--/;
const TREE_LINE_RE = /^(.*?)(?:├|└)[─-]{2,}\s+(.+)$/;
const ASCII_TREE_LINE_RE = /^(.*?)(?:\+--|\\--|\|--)\s+(.+)$/;
const LS_HEADER_RE = /^(.+):$/;
const TREE_IGNORED_RE = /^(?:\d+\s+directories?,\s+\d+\s+files?|\d+\s+files?)$/i;
const WINDOWS_TREE_IGNORED_RE = /^(?:Folder PATH listing|Volume serial number is)/i;
const LS_ERROR_RE = /^ls:\s+/i;

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized === ".") return "";
  return normalized;
}

function countTreeDepth(prefix: string): number {
  const normalized = prefix.replace(/\t/g, "    ");
  const matches = normalized.match(/(?:\|   |│   |    )/g);
  return matches ? matches.length : 0;
}

function parseTreeLine(raw: string): TreeNode | null {
  if (!TREE_MARKER_RE.test(raw)) return null;
  const match = raw.match(TREE_LINE_RE) ?? raw.match(ASCII_TREE_LINE_RE);
  if (!match) return null;
  const prefix = match[1] ?? "";
  const nameRaw = match[2] ?? "";
  const depth = countTreeDepth(prefix);
  const cleaned = nameRaw.trim();
  const isDirHint = /[\\/]+$/.test(cleaned);
  const name = cleaned.replace(/[\\/]+$/, "");
  if (!name || name === ".") return null;
  return { depth, name, line: 0, isDirHint };
}

function normalizeRepoRoot(value: string): string {
  const normalized = normalizePath(value);
  if (!normalized) return "";
  if (normalized === ".") return "";
  if (/^[A-Za-z]:\.$/.test(normalized)) return "";
  return normalized;
}

function buildTreePaths(nodes: TreeNode[], issues: RepoPathParseIssue[]): string[] {
  const stack: string[] = [];
  const paths: string[] = [];

  nodes.forEach((node, index) => {
    const next = nodes[index + 1];
    const isDir = node.isDirHint || (next ? next.depth > node.depth : false);
    if (node.depth > stack.length) {
      issues.push({
        line: node.line,
        message: "Unexpected tree indentation. Paste the full tree output.",
        text: node.name,
      });
    }
    stack.length = Math.min(node.depth, stack.length);
    stack[node.depth] = normalizePath(node.name);
    if (!isDir) {
      const path = normalizePath(stack.slice(0, node.depth + 1).join("/"));
      if (path) paths.push(path);
    }
  });

  return paths;
}

export function parseRepoInput(text: string): RepoPathParseResult {
  const issues: RepoPathParseIssue[] = [];
  const paths: string[] = [];
  const treeNodes: TreeNode[] = [];
  const lsEntries: string[] = [];
  const lsHeaders = new Set<string>();
  const lines = text.split("\n");
  const hasTreeMarkers = lines.some((line) => TREE_MARKER_RE.test(line));
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  let currentLsDir: string | null = null;

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) return;
    if (TREE_IGNORED_RE.test(trimmed) || WINDOWS_TREE_IGNORED_RE.test(trimmed)) return;
    if (LS_ERROR_RE.test(trimmed)) {
      issues.push({ line: lineNumber, message: "Command error from ls -R.", text: trimmed });
      return;
    }

    const headerMatch = trimmed.match(LS_HEADER_RE);
    if (headerMatch) {
      const headerRaw = headerMatch[1]?.trim() ?? "";
      const normalizedHeader = normalizeRepoRoot(headerRaw);
      currentLsDir = normalizedHeader;
      if (normalizedHeader) {
        lsHeaders.add(normalizedHeader);
      }
      return;
    }

    const treeNode = parseTreeLine(line);
    if (treeNode) {
      treeNodes.push({ ...treeNode, line: lineNumber });
      return;
    }

    if (currentLsDir !== null) {
      if (trimmed === "." || trimmed === "..") return;
      const entry = normalizePath(trimmed);
      if (!entry) return;
      const combined = normalizePath(currentLsDir ? `${currentLsDir}/${entry}` : entry);
      if (combined) lsEntries.push(combined);
      return;
    }

    if (hasTreeMarkers && lineNumber === firstContentIndex + 1 && !TREE_MARKER_RE.test(line)) {
      return;
    }

    if (hasTreeMarkers) {
      issues.push({
        line: lineNumber,
        message: "Unrecognized tree line. Paste the full output from `tree` or `ls -R`.",
        text: trimmed,
      });
      return;
    }

    const normalized = normalizePath(trimmed);
    if (normalized) paths.push(normalized);
  });

  if (treeNodes.length > 0) {
    const treePaths = buildTreePaths(treeNodes, issues);
    paths.push(...treePaths);
  }

  if (lsEntries.length > 0) {
    paths.push(...lsEntries.filter((entry) => !lsHeaders.has(entry)));
  }

  const unique = Array.from(new Set(paths)).filter(Boolean);
  return { paths: unique, issues };
}
