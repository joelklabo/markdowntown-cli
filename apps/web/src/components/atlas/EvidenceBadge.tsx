import React from "react";
import { cn } from "@/lib/cn";

type EvidenceBadgeProps = {
  url: string;
  label?: string;
  className?: string;
};

function defaultLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

export function EvidenceBadge({ url, label, className }: EvidenceBadgeProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-mdt-2 rounded-mdt-pill border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-[3px] text-caption font-medium text-mdt-text hover:bg-mdt-surface-strong",
        className
      )}
    >
      <span className="truncate">{label ?? defaultLabel(url)}</span>
      <span aria-hidden className="text-[10px] text-mdt-muted">
        ↗
      </span>
    </a>
  );
}

