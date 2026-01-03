import React from "react";
import { cn } from "@/lib/cn";

export type KbdProps = React.HTMLAttributes<HTMLElement>;

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center gap-mdt-1 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-2 py-[1px] font-mono text-caption text-mdt-text shadow-mdt-sm",
        className
      )}
      {...props}
    />
  );
}

