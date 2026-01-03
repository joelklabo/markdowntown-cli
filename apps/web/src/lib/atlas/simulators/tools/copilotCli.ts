import type { LoadedFile } from '../types.ts';

type TreeReader = {
  has: (filePath: string) => boolean;
  listPaths: () => string[];
};

export function simulateCopilotCli(tree: TreeReader): LoadedFile[] {
  const loaded: LoadedFile[] = [];

  if (tree.has('.github/copilot-instructions.md')) {
    loaded.push({
      path: '.github/copilot-instructions.md',
      reason: 'repo instructions (.github/copilot-instructions.md)',
    });
  }

  const scopedInstructions = tree
    .listPaths()
    .filter(
      (path) =>
        path.startsWith('.github/copilot-instructions/') && path.endsWith('.instructions.md'),
    );

  for (const path of scopedInstructions) {
    loaded.push({
      path,
      reason: 'scoped instructions (.github/copilot-instructions/**/*.instructions.md)',
    });
  }

  const agentProfiles = tree.listPaths().filter((path) => path.startsWith('.github/agents/'));

  for (const path of agentProfiles) {
    loaded.push({
      path,
      reason: 'agent profiles (.github/agents/*)',
    });
  }

  return loaded;
}

