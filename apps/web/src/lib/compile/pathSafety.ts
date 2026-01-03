function normalizeZipEntryPath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\.\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
}

function validateZipEntryPath(input: string): { ok: true; normalized: string } | { ok: false; error: string } {
  if (input.length === 0) return { ok: false, error: 'path is empty' };
  if (input.includes('\0')) return { ok: false, error: 'path contains NUL byte' };

  const normalized = normalizeZipEntryPath(input);
  if (normalized.length === 0) return { ok: false, error: 'path resolves to empty' };
  if (normalized.startsWith('/')) return { ok: false, error: 'absolute paths are not allowed' };
  if (/^[a-zA-Z]:\//.test(normalized)) return { ok: false, error: 'drive-letter paths are not allowed' };

  const segments = normalized.split('/').filter(seg => seg !== '.' && seg !== '');
  if (segments.length === 0) return { ok: false, error: 'path resolves to empty' };
  if (segments.some(seg => seg === '..')) return { ok: false, error: "'..' segments are not allowed" };

  return { ok: true, normalized: segments.join('/') };
}

export function assertSafeZipEntryPath(input: string): string {
  const result = validateZipEntryPath(input);
  if (!result.ok) {
    throw new Error(`Unsafe zip entry path '${input}': ${result.error}`);
  }
  return result.normalized;
}
