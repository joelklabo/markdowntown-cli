import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

type HeadingLevel = "display" | "h1" | "h2" | "h3";

const headingVariants = cva("font-display", {
  variants: {
    level: {
      display: "text-display",
      h1: "text-h1",
      h2: "text-h2",
      h3: "text-h3",
    },
    tone: {
      default: "text-mdt-text",
      muted: "text-mdt-muted",
      subtle: "text-mdt-text-subtle",
      onStrong: "text-mdt-text-on-strong",
    },
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    leading: {
      tight: "leading-tight",
      normal: "leading-normal",
      relaxed: "leading-relaxed",
    },
    tracking: {
      tight: "tracking-tight",
      normal: "tracking-normal",
      wide: "tracking-wide",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    level: "h2",
    tone: "default",
    weight: "semibold",
  },
});

const defaultTag: Record<HeadingLevel, React.ElementType> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
};

export type HeadingProps = VariantProps<typeof headingVariants> & {
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>;

export function Heading({ level = "h2", as, tone, weight, leading, tracking, align, className, ...props }: HeadingProps) {
  const Comp = as ?? defaultTag[level as HeadingLevel];
  return (
    <Comp
      className={cn(headingVariants({ level, tone, weight, leading, tracking, align }), className)}
      {...props}
    />
  );
}
