import { IconButton } from "./IconButton";
import { cn } from "@/lib/cn";
import React from "react";

type TagProps = {
  label: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
  onRemove?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

export function Tag({ label, tone = "neutral", onRemove, className, ...props }: TagProps) {
  const toneMap: Record<NonNullable<TagProps["tone"]>, string> = {
    neutral: "border-mdt-border bg-mdt-surface-subtle text-mdt-text",
    primary:
      "border-[color:var(--mdt-color-primary)]/25 bg-[color:var(--mdt-color-primary-soft)] text-[color:var(--mdt-color-primary-strong)]",
    success:
      "border-[color:var(--mdt-color-success)]/25 bg-[color:var(--mdt-color-success-soft)] text-[color:var(--mdt-success-700)]",
    warning:
      "border-[color:var(--mdt-color-warning)]/25 bg-[color:var(--mdt-color-warning-soft)] text-[color:var(--mdt-warning-700)]",
    danger:
      "border-[color:var(--mdt-color-danger)]/25 bg-[color:var(--mdt-color-danger-soft)] text-[color:var(--mdt-danger-700)]",
    info:
      "border-[color:var(--mdt-color-info)]/25 bg-[color:var(--mdt-color-info-soft)] text-[color:var(--mdt-info-700)]",
  };
  return (
    <div
      className={cn(
        "inline-flex h-mdt-8 items-center gap-mdt-2 rounded-mdt-pill border px-mdt-3 text-body-sm",
        toneMap[tone],
        className
      )}
      {...props}
    >
      <span className="font-medium">{label}</span>
      {onRemove ? (
        <IconButton
          variant="ghost"
          size="xs"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="h-mdt-7 w-mdt-7 text-caption"
        >
          ×
        </IconButton>
      ) : null}
    </div>
  );
}
