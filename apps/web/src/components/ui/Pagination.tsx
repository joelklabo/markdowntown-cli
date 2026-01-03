import { IconButton } from "./IconButton";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import React from "react";

type Props = {
  current: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({ current, total, onPageChange, className }: Props) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  if (total <= 1) return null;
  return (
    <nav className={cn("flex items-center gap-mdt-2 text-body-sm", className)} aria-label="Pagination">
      <IconButton
        variant="secondary"
        size="sm"
        disabled={current === 1}
        aria-label="Previous page"
        onClick={() => onPageChange(Math.max(1, current - 1))}
      >
        ‹
      </IconButton>
      <div className="flex items-center gap-1">
        {pages.map((p) => {
          const active = p === current;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "min-w-[34px] rounded-mdt-md border px-mdt-2 py-mdt-1 text-caption font-medium",
                interactiveBase,
                focusRing,
                active
                  ? "bg-[color:var(--mdt-color-primary-soft)] text-[color:var(--mdt-color-primary-strong)] border border-mdt-border-strong shadow-mdt-sm"
                  : "text-mdt-text-muted hover:bg-[color:var(--mdt-color-surface-subtle)] hover:text-[color:var(--mdt-color-text)] border-transparent"
              )}
              aria-current={active ? "page" : undefined}
            >
              {p}
            </button>
          );
        })}
      </div>
      <IconButton
        variant="secondary"
        size="sm"
        disabled={current === total}
        aria-label="Next page"
        onClick={() => onPageChange(Math.min(total, current + 1))}
      >
        ›
      </IconButton>
    </nav>
  );
}
