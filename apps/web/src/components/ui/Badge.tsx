import { cn } from "@/lib/cn";
import React from "react";

type BadgeProps = {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
} & React.HTMLAttributes<HTMLSpanElement>;

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  const toneMap: Record<NonNullable<BadgeProps["tone"]>, string> = {
    neutral: "bg-[color:var(--mdt-color-surface-subtle)] text-mdt-text",
    primary: "bg-[color:var(--mdt-color-primary-soft)] text-mdt-text",
    success: "bg-[color:var(--mdt-color-success-soft)] text-[color:var(--mdt-success-700)]",
    warning: "bg-[color:var(--mdt-color-warning-soft)] text-[color:var(--mdt-warning-700)]",
    danger: "bg-[color:var(--mdt-color-danger-soft)] text-[color:var(--mdt-danger-700)]",
    info: "bg-[color:var(--mdt-color-info-soft)] text-[color:var(--mdt-info-700)]",
  };
  return (
    <span
      className={cn(
        "inline-flex h-mdt-7 items-center gap-mdt-1 rounded-mdt-pill px-mdt-2 text-caption font-semibold leading-none",
        toneMap[tone],
        className
      )}
      {...props}
    />
  );
}
