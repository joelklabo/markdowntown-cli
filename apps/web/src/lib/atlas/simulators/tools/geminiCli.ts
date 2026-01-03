import type { LoadedFile } from '../types.ts';

type TreeReader = {
  has: (filePath: string) => boolean;
};

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return '';
  return normalized;
}

function ancestorDirs(cwd: string): string[] {
  const normalized = normalizePath(cwd);
  const parts = normalized ? normalized.split('/') : [];
  const dirs: string[] = [''];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    dirs.push(current);
  }
  return dirs;
}

function joinDirFile(dir: string, fileName: string): string {
  return dir ? `${dir}/${fileName}` : fileName;
}

export function simulateGeminiCli(tree: TreeReader, cwd: string): LoadedFile[] {
  const loaded: LoadedFile[] = [];

  for (const dir of ancestorDirs(cwd)) {
    const candidate = joinDirFile(dir, 'GEMINI.md');
    if (!tree.has(candidate)) continue;
    loaded.push({
      path: candidate,
      reason: dir ? `directory instructions (${dir})` : 'repo instructions (root)',
    });
  }

  return loaded;
}
