import React from "react";
import { cn } from "@/lib/cn";

const gapMap = {
  0: "gap-mdt-0",
  1: "gap-mdt-1",
  2: "gap-mdt-2",
  3: "gap-mdt-3",
  4: "gap-mdt-4",
  5: "gap-mdt-5",
  6: "gap-mdt-6",
  7: "gap-mdt-7",
  8: "gap-mdt-8",
  9: "gap-mdt-9",
  10: "gap-mdt-10",
  12: "gap-mdt-12",
} as const;

type Gap = keyof typeof gapMap;

export type GridProps = React.HTMLAttributes<HTMLDivElement> & {
  columns?: number;
  minColWidth?: string;
  gap?: Gap;
};

export function Grid({ columns, minColWidth, gap = 4, className, style, ...props }: GridProps) {
  const template = minColWidth
    ? `repeat(auto-fill, minmax(${minColWidth}, 1fr))`
    : columns
      ? `repeat(${columns}, minmax(0, 1fr))`
      : undefined;

  return (
    <div
      className={cn("grid", gapMap[gap], className)}
      style={{ ...style, gridTemplateColumns: template }}
      {...props}
    />
  );
}

