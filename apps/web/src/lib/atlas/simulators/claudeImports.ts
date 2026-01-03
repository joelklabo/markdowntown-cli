type ClaudeImportTree = {
  has: (filePath: string) => boolean;
  getContent: (filePath: string) => string | null;
};

export type ClaudeImportIssueType = "missing" | "outside-root" | "circular";

export type ClaudeImportIssue = {
  type: ClaudeImportIssueType;
  sourcePath: string;
  rawPath: string;
  resolvedPath: string;
};

export type ClaudeImportResult = {
  imported: string[];
  issues: ClaudeImportIssue[];
};

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized === ".") return "";
  return normalized;
}

function dirName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function sanitizeImportToken(token: string): string {
  let cleaned = token.trim();
  cleaned = cleaned.replace(/^[("'`]+/, "");
  cleaned = cleaned.replace(/[)"'`,.;:]+$/, "");
  return cleaned;
}

function extractClaudeImports(content: string): string[] {
  const imports = new Set<string>();
  const regex = /(?:^|\s)@([^\s"'`<>]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const cleaned = sanitizeImportToken(match[1] ?? "");
    if (!cleaned) continue;
    imports.add(cleaned);
  }
  return Array.from(imports);
}

function resolveImportPath(sourcePath: string, rawImport: string): { path: string; outsideRoot: boolean } {
  const cleaned = sanitizeImportToken(rawImport);
  if (!cleaned) return { path: "", outsideRoot: false };
  const normalized = cleaned.replace(/\\/g, "/");
  const rooted = normalized.startsWith("/");
  const baseDir = rooted ? "" : dirName(normalizePath(sourcePath));
  const segments = normalized.replace(/^\/+/, "").split("/");
  const stack = baseDir ? baseDir.split("/") : [];
  let outsideRoot = false;

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) {
        outsideRoot = true;
      } else {
        stack.pop();
      }
      continue;
    }
    stack.push(segment);
  }

  return { path: stack.join("/"), outsideRoot };
}

export function resolveClaudeImports(tree: ClaudeImportTree, entryPaths: string[]): ClaudeImportResult {
  const imported: string[] = [];
  const importedSet = new Set<string>();
  const issues: ClaudeImportIssue[] = [];
  const visited = new Set<string>();

  const visit = (sourcePath: string, stack: string[]) => {
    const content = tree.getContent(sourcePath);
    if (!content) return;
    for (const rawImport of extractClaudeImports(content)) {
      const resolved = resolveImportPath(sourcePath, rawImport);
      if (!resolved.path) continue;
      if (resolved.outsideRoot) {
        issues.push({
          type: "outside-root",
          sourcePath,
          rawPath: rawImport,
          resolvedPath: resolved.path,
        });
        continue;
      }
      if (stack.includes(resolved.path)) {
        issues.push({
          type: "circular",
          sourcePath,
          rawPath: rawImport,
          resolvedPath: resolved.path,
        });
        continue;
      }
      if (!tree.has(resolved.path)) {
        issues.push({
          type: "missing",
          sourcePath,
          rawPath: rawImport,
          resolvedPath: resolved.path,
        });
        continue;
      }
      if (!importedSet.has(resolved.path)) {
        importedSet.add(resolved.path);
        imported.push(resolved.path);
      }
      if (!visited.has(resolved.path)) {
        visited.add(resolved.path);
        visit(resolved.path, [...stack, resolved.path]);
      }
    }
  };

  for (const entryPath of entryPaths) {
    const normalized = normalizePath(entryPath);
    if (!normalized || !tree.has(normalized)) continue;
    if (!visited.has(normalized)) {
      visited.add(normalized);
      visit(normalized, [normalized]);
    }
  }

  return { imported, issues };
}
