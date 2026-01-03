import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const surfaceVariants = cva("rounded-mdt-md border border-mdt-border", {
  variants: {
    tone: {
      default: "bg-mdt-surface",
      subtle: "bg-mdt-surface-subtle",
      strong: "bg-mdt-surface-strong",
      raised: "bg-mdt-surface-raised border-mdt-border shadow-mdt-sm",
    },
    padding: {
      none: "p-0",
      sm: "p-mdt-4",
      md: "p-mdt-6",
      lg: "p-mdt-8",
    },
  },
  defaultVariants: {
    tone: "default",
    padding: "md",
  },
});

type SurfaceVariants = VariantProps<typeof surfaceVariants>;

type PolymorphicProps<C extends React.ElementType, Props> =
  Props & { as?: C } & Omit<React.ComponentPropsWithoutRef<C>, keyof Props | "as">;

export type SurfaceProps<C extends React.ElementType = "div"> = PolymorphicProps<C, SurfaceVariants>;

export function Surface<C extends React.ElementType = "div">({
  as,
  tone,
  padding,
  className,
  ...props
}: SurfaceProps<C>) {
  const Comp = (as ?? "div") as React.ElementType;
  return (
    <Comp
      className={cn(surfaceVariants({ tone, padding }), className)}
      {...props}
    />
  );
}
