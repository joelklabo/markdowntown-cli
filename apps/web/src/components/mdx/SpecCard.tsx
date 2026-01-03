import React from "react";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

type SpecTone = "yes" | "partial" | "no" | "neutral";

type SpecCardProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  value?: string;
  tone?: SpecTone;
  children?: React.ReactNode;
};

function pillTone(tone: SpecTone): React.ComponentProps<typeof Pill>["tone"] {
  if (tone === "yes") return "green";
  if (tone === "partial") return "yellow";
  if (tone === "no") return "gray";
  return "primary";
}

export function SpecCard({ title, value, tone = "neutral", children, className, ...props }: SpecCardProps) {
  return (
    <div
      className={cn(
        "rounded-mdt-lg border border-mdt-border/80 bg-mdt-surface-subtle p-mdt-4 text-mdt-text shadow-mdt-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-mdt-3">
        <div className="text-body-sm font-semibold text-mdt-text">{title}</div>
        {value ? <Pill tone={pillTone(tone)}>{value}</Pill> : null}
      </div>
      {children ? <div className="mt-mdt-2 text-body-sm leading-relaxed text-mdt-muted">{children}</div> : null}
    </div>
  );
}
