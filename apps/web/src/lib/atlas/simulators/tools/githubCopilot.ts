import type { LoadedFile } from '../types.ts';

type TreeReader = {
  has: (filePath: string) => boolean;
  listPaths: () => string[];
};

export function simulateGitHubCopilot(tree: TreeReader): LoadedFile[] {
  const loaded: LoadedFile[] = [];

  if (tree.has('.github/copilot-instructions.md')) {
    loaded.push({
      path: '.github/copilot-instructions.md',
      reason: 'repo instructions (.github/copilot-instructions.md)',
    });
  }

  const scoped = tree
    .listPaths()
    .filter((path) => path.startsWith('.github/instructions/') && path.endsWith('.instructions.md'));

  for (const path of scoped) {
    loaded.push({
      path,
      reason: 'scoped instructions (.github/instructions/*.instructions.md)',
    });
  }

  return loaded;
}
