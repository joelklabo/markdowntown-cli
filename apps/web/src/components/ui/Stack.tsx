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
  11: "gap-mdt-11",
  12: "gap-mdt-12",
} as const;

type Gap = keyof typeof gapMap;

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
} as const;

export type StackProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  direction?: "vertical" | "horizontal";
  gap?: Gap;
  align?: keyof typeof alignMap;
  justify?: keyof typeof justifyMap;
  wrap?: boolean;
};

export function Stack({
  as: Comp = "div",
  direction = "vertical",
  gap = 4,
  align,
  justify,
  wrap = false,
  className,
  ...props
}: StackProps) {
  return (
    <Comp
      className={cn(
        "flex",
        direction === "vertical" ? "flex-col" : "flex-row",
        gapMap[gap],
        align ? alignMap[align] : undefined,
        justify ? justifyMap[justify] : undefined,
        wrap ? "flex-wrap" : "flex-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function Row(props: Omit<StackProps, "direction">) {
  return <Stack direction="horizontal" {...props} />;
}
