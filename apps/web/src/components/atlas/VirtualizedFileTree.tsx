import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const ROW_HEIGHT = 28;
const OVERSCAN_COUNT = 6;

type TreeNode = {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
};

type TreeRow = {
  id: string;
  name: string;
  fullPath: string;
  depth: number;
  isFile: boolean;
  hasChildren: boolean;
};

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", fullPath: "", children: new Map(), isFile: false };

  for (const raw of paths) {
    const normalized = normalizePath(raw);
    if (normalized.length === 0) continue;

    const parts = normalized.split("/").filter(Boolean);
    let node = root;
    let running = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      running = running ? `${running}/${part}` : part;
      const existing = node.children.get(part);
      const next: TreeNode = existing ?? { name: part, fullPath: running, children: new Map(), isFile: false };
      node.children.set(part, next);
      node = next;
      if (i === parts.length - 1) node.isFile = true;
    }
  }

  return root;
}

function sortNodes(nodes: Iterable<TreeNode>) {
  return Array.from(nodes).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function collectDirectoryPaths(node: TreeNode, out: Set<string>) {
  for (const child of node.children.values()) {
    if (!child.isFile) {
      out.add(child.fullPath);
      collectDirectoryPaths(child, out);
    }
  }
}

function flattenTree(node: TreeNode, depth: number, expanded: Set<string>, rows: TreeRow[]) {
  const children = sortNodes(node.children.values());
  for (const child of children) {
    const hasChildren = child.children.size > 0;
    rows.push({
      id: child.fullPath,
      name: child.name,
      fullPath: child.fullPath,
      depth,
      isFile: child.isFile,
      hasChildren,
    });
    if (hasChildren && expanded.has(child.fullPath)) {
      flattenTree(child, depth + 1, expanded, rows);
    }
  }
}

export type VirtualizedFileTreeProps = {
  paths: string[];
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
  className?: string;
  height?: number;
  emptyLabel?: string;
  ariaLabel?: string;
};

export function VirtualizedFileTree({
  paths,
  selectedPath,
  onSelect,
  className,
  height = 320,
  emptyLabel = "No files.",
  ariaLabel = "File tree",
}: VirtualizedFileTreeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(height);
  const [scrollTop, setScrollTop] = useState(0);

  const tree = useMemo(() => buildTree(paths), [paths]);
  const defaultExpanded = useMemo(() => {
    const expanded = new Set<string>();
    collectDirectoryPaths(tree, expanded);
    return expanded;
  }, [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  useEffect(() => {
    setScrollTop(0);
  }, [paths.length]);

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const update = () => {
      const nextHeight = element.clientHeight || height;
      setViewportHeight(nextHeight);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  const rows = useMemo(() => {
    const next: TreeRow[] = [];
    flattenTree(tree, 0, expanded, next);
    return next;
  }, [expanded, tree]);

  if (paths.length === 0) {
    return <div className={cn("text-mdt-muted text-body-sm", className)}>{emptyLabel}</div>;
  }

  const totalHeight = rows.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_COUNT,
  );
  const offsetY = startIndex * ROW_HEIGHT;
  const visibleRows = rows.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto rounded-mdt-md border border-mdt-border bg-mdt-surface", className)}
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      data-testid="virtualized-file-tree"
      role="tree"
      aria-label={ariaLabel}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleRows.map((row) => {
            const isSelected = selectedPath === row.fullPath;
            const isExpanded = expanded.has(row.fullPath);
            return (
              <div
                key={row.id}
                className={cn(
                  "flex items-center gap-1 px-2 text-body-sm",
                  isSelected ? "bg-mdt-primary/10" : "hover:bg-mdt-surface-subtle",
                )}
                style={{ height: ROW_HEIGHT, paddingLeft: row.depth * 12 }}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    className="text-mdt-muted"
                    aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                    onClick={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.fullPath)) {
                          next.delete(row.fullPath);
                        } else {
                          next.add(row.fullPath);
                        }
                        return next;
                      });
                    }}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="w-4 text-mdt-muted">•</span>
                )}
                {row.isFile ? (
                  <button
                    type="button"
                    onClick={() => onSelect?.(row.fullPath)}
                    disabled={!onSelect}
                    className={cn(
                      "flex-1 truncate text-left font-mono",
                      isSelected ? "text-mdt-primary" : "text-mdt-text",
                      !onSelect ? "cursor-default" : "",
                    )}
                  >
                    {row.name}
                  </button>
                ) : (
                  <span className="flex-1 truncate text-mdt-muted">{row.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
