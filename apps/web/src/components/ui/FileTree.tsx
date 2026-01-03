import React from 'react';
import { cn } from '@/lib/cn';

type TreeNode = {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
};

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', children: new Map(), isFile: false };

  for (const raw of paths) {
    const normalized = normalizePath(raw);
    if (normalized.length === 0) continue;

    const parts = normalized.split('/').filter(Boolean);
    let node = root;
    let running = '';

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

function Tree({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
}) {
  const items = sortNodes(node.children.values());
  if (items.length === 0) return null;

  return (
    <ul className="space-y-1">
      {items.map((child) => {
        const selected = selectedPath === child.fullPath;

        return (
          <li key={child.fullPath}>
            {child.isFile ? (
              <button
                type="button"
                onClick={() => onSelect?.(child.fullPath)}
                disabled={!onSelect}
                className={cn(
                  'w-full text-left font-mono text-caption px-2 py-1 rounded border',
                  selected ? 'border-mdt-primary bg-mdt-primary/10' : 'border-transparent hover:bg-mdt-surface-subtle',
                  depth > 0 ? 'ml-2' : ''
                )}
              >
                {child.name}
              </button>
            ) : (
              <div className={cn('text-caption text-mdt-muted px-2 py-1', depth > 0 ? 'ml-2' : '')}>
                {child.name}
              </div>
            )}

            {!child.isFile && (
              <div className="ml-2">
                <Tree node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type FileTreeProps = {
  paths: string[];
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
  className?: string;
  emptyLabel?: string;
};

export function FileTree({ paths, selectedPath, onSelect, className, emptyLabel = 'No files.' }: FileTreeProps) {
  const tree = React.useMemo(() => buildTree(paths), [paths]);

  if (paths.length === 0) {
    return <div className={cn('text-mdt-muted text-body-sm', className)}>{emptyLabel}</div>;
  }

  return (
    <div className={cn('min-w-0', className)}>
      <Tree node={tree} depth={0} selectedPath={selectedPath} onSelect={onSelect} />
    </div>
  );
}

