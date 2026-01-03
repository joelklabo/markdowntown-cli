"use client";

import { CopyButton } from "@/components/atlas/CopyButton";
import { cn } from "@/lib/cn";

type PathChipProps = {
  path: string;
  className?: string;
};

export function PathChip({ path, className }: PathChipProps) {
  return (
    <CopyButton
      text={path}
      label={path}
      copiedLabel="Copied"
      variant="secondary"
      size="xs"
      className={cn("rounded-mdt-pill font-mono text-[11px]", className)}
      aria-label={`Copy ${path}`}
    />
  );
}

