import React from "react";
import { cn } from "@/lib/cn";

type Edit =
  | { type: "equal"; line: string }
  | { type: "insert"; line: string }
  | { type: "delete"; line: string };

type DiffLine = {
  kind: "meta" | "context" | "add" | "del";
  text: string;
};

function splitLines(input: string): string[] {
  const normalized = input.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function backtrackMyers(traces: Array<Map<number, number>>, a: string[], b: string[]): Edit[] {
  let x = a.length;
  let y = b.length;
  const edits: Edit[] = [];

  for (let d = traces.length - 1; d > 0; d--) {
    const vPrev = traces[d - 1]!;
    const k = x - y;

    const left = vPrev.get(k - 1) ?? 0;
    const right = vPrev.get(k + 1) ?? 0;
    const prevK = k === -d || (k !== d && left < right) ? k + 1 : k - 1;

    const prevX = vPrev.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      edits.push({ type: "equal", line: a[x - 1]! });
      x--;
      y--;
    }

    if (x === prevX) {
      edits.push({ type: "insert", line: b[y - 1]! });
      y--;
    } else {
      edits.push({ type: "delete", line: a[x - 1]! });
      x--;
    }
  }

  while (x > 0 && y > 0) {
    edits.push({ type: "equal", line: a[x - 1]! });
    x--;
    y--;
  }
  while (x > 0) {
    edits.push({ type: "delete", line: a[x - 1]! });
    x--;
  }
  while (y > 0) {
    edits.push({ type: "insert", line: b[y - 1]! });
    y--;
  }

  return edits.reverse();
}

function myersDiff(a: string[], b: string[]): Edit[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;

  let v = new Map<number, number>();
  v.set(1, 0);

  const traces: Array<Map<number, number>> = [];

  for (let d = 0; d <= max; d++) {
    const vNext = new Map<number, number>();

    for (let k = -d; k <= d; k += 2) {
      const down = v.get(k + 1) ?? 0;
      const right = (v.get(k - 1) ?? 0) + 1;

      let x = k === -d || (k !== d && down > right) ? down : right;
      let y = x - k;

      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }

      vNext.set(k, x);
      if (x >= n && y >= m) {
        traces.push(vNext);
        return backtrackMyers(traces, a, b);
      }
    }

    traces.push(vNext);
    v = vNext;
  }

  return a.map((line) => ({ type: "delete", line }));
}

function buildUnifiedDiff(before: string, after: string, fileName: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const edits = myersDiff(a, b);

  const lines: DiffLine[] = [
    { kind: "meta", text: `--- a/${fileName}` },
    { kind: "meta", text: `+++ b/${fileName}` },
  ];

  for (const edit of edits) {
    if (edit.type === "equal") lines.push({ kind: "context", text: ` ${edit.line}` });
    if (edit.type === "delete") lines.push({ kind: "del", text: `-${edit.line}` });
    if (edit.type === "insert") lines.push({ kind: "add", text: `+${edit.line}` });
  }

  return lines;
}

export type DiffViewerProps = {
  before: string;
  after: string;
  fileName?: string;
  className?: string;
};

export function DiffViewer({ before, after, fileName = "diff.txt", className }: DiffViewerProps) {
  const lines = React.useMemo(() => buildUnifiedDiff(before, after, fileName), [after, before, fileName]);

  return (
    <pre
      data-testid="diff-viewer"
      className={cn(
        "overflow-auto rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-3 text-xs font-mono text-mdt-text",
        className
      )}
    >
      <code>
        {lines.map((line, idx) => (
          <span
            key={idx}
            className={cn(
              "block whitespace-pre",
              line.kind === "meta" && "text-mdt-muted",
              line.kind === "add" && "bg-[color:var(--mdt-color-success-soft)] text-[color:var(--mdt-success-700)]",
              line.kind === "del" && "bg-[color:var(--mdt-color-danger-soft)] text-[color:var(--mdt-danger-700)]"
            )}
          >
            {line.text}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
}
