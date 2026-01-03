import type { LoadedFile } from '../types.ts';

type TreeReader = {
  has: (filePath: string) => boolean;
  listPaths: () => string[];
};

function isCursorRuleFile(path: string): boolean {
  return path.startsWith('.cursor/rules/') && path.endsWith('.mdc');
}

export function simulateCursorRules(tree: TreeReader): LoadedFile[] {
  const loaded: LoadedFile[] = [];
  const ruleFiles = tree.listPaths().filter(isCursorRuleFile).sort();

  for (const path of ruleFiles) {
    loaded.push({
      path,
      reason: 'cursor rule (.cursor/rules/*.mdc)',
    });
  }

  if (tree.has('.cursorrules')) {
    loaded.push({
      path: '.cursorrules',
      reason: ruleFiles.length > 0
        ? 'legacy cursor rules (.cursorrules, deprecated)'
        : 'legacy cursor rules (.cursorrules)',
    });
  }

  return loaded;
}
