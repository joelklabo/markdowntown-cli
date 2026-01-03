import React from "react";
import { EvidenceBadge } from "@/components/atlas/EvidenceBadge";
import { cn } from "@/lib/cn";

type EvidenceProps = React.HTMLAttributes<HTMLDivElement> & {
  url: string;
  label?: string;
  children?: React.ReactNode;
};

export function Evidence({ url, label, children, className, ...props }: EvidenceProps) {
  return (
    <div className={cn("inline-flex flex-col gap-mdt-2", className)} {...props}>
      <EvidenceBadge url={url} label={label} />
      {children ? (
        <div className="rounded-mdt-md border border-mdt-border/70 bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-body-xs leading-relaxed text-mdt-muted">
          {children}
        </div>
      ) : null}
    </div>
  );
}
