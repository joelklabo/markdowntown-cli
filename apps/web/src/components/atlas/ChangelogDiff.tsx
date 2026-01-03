import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

type DiffKind = "added" | "removed" | "changed";

type DiffRow = {
  path: string;
  kind: DiffKind;
  before: unknown;
  after: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSafeIdentifier(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function joinPath(base: string, key: string): string {
  if (!base) return key;
  if (isSafeIdentifier(key)) return `${base}.${key}`;
  return `${base}[${JSON.stringify(key)}]`;
}

function formatInline(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const text = JSON.stringify(value);
    if (text && text.length <= 140) return text;
  } catch {
    // ignore
  }
  return "[complex]";
}

function diffValues(before: unknown, after: unknown, path: string, out: DiffRow[]) {
  if (before === after) return;

  const normalizedPath = path || "(root)";

  if (before === undefined && after !== undefined) {
    out.push({ path: normalizedPath, kind: "added", before, after });
    return;
  }

  if (before !== undefined && after === undefined) {
    out.push({ path: normalizedPath, kind: "removed", before, after });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i += 1) {
      diffValues(before[i], after[i], path ? `${path}[${i}]` : `[${i}]`, out);
    }
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffValues(before[key], after[key], joinPath(path, key), out);
    }
    return;
  }

  out.push({ path: normalizedPath, kind: "changed", before, after });
}

type ChangelogDiffProps = {
  before: unknown;
  after: unknown;
};

export function ChangelogDiff({ before, after }: ChangelogDiffProps) {
  const rows: DiffRow[] = [];
  diffValues(before, after, "", rows);

  if (rows.length === 0) {
    return (
      <Text size="bodySm" tone="muted">
        No changes.
      </Text>
    );
  }

  const tone = (kind: DiffKind) => {
    if (kind === "added") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (kind === "removed") return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  };

  return (
    <ul className="space-y-mdt-2">
      {rows.map((row) => (
        <li
          key={`${row.kind}:${row.path}`}
          className={cn("rounded-mdt-lg border px-mdt-3 py-mdt-2", tone(row.kind))}
        >
          <div className="font-mono text-caption">{row.path}</div>
          <div className="mt-mdt-1 text-body-xs">
            <span className="font-mono opacity-80">{formatInline(row.before)}</span>
            <span className="mx-mdt-2 opacity-60" aria-hidden>
              →
            </span>
            <span className="font-mono">{formatInline(row.after)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
