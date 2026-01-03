import Link from "next/link";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import type { AtlasChangelogEntry } from "@/lib/atlas/load";

type ChangelogFeedProps = {
  entries: AtlasChangelogEntry[];
};

function isoDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function ChangelogFeed({ entries }: ChangelogFeedProps) {
  return (
    <div className="grid gap-mdt-3">
      {entries.map((entry) => {
        const date = isoDate(entry.date);
        return (
          <Link
            key={entry.id}
            href={`/atlas/changelog/${entry.id}`}
            className={cn(
              "rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm hover:bg-mdt-surface-raised",
              interactiveBase,
              focusRing
            )}
          >
            <div className="text-body-sm font-semibold text-mdt-text">{entry.summary}</div>
            <div className="mt-mdt-1 text-caption text-mdt-muted">
              <span className="font-mono text-mdt-text">{entry.id}</span>
              <span className="mx-mdt-2" aria-hidden>
                ·
              </span>
              <span>{date ?? "—"}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
