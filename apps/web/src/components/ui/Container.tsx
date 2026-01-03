import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const containerVariants = cva("mx-auto w-full", {
  variants: {
    size: {
      sm: "max-w-3xl",
      md: "max-w-5xl",
      lg: "max-w-6xl",
      xl: "max-w-7xl",
      full: "max-w-none",
    },
    padding: {
      none: "px-0",
      sm: "px-mdt-3 md:px-mdt-4",
      md: "px-mdt-4 md:px-mdt-6",
      lg: "px-mdt-6 md:px-mdt-8",
    },
  },
  defaultVariants: {
    size: "lg",
    padding: "md",
  },
});

export type ContainerProps = VariantProps<typeof containerVariants> & {
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>;

export function Container({ as: Comp = "div", size, padding, className, ...props }: ContainerProps) {
  return (
    <Comp
      className={cn(containerVariants({ size, padding }), className)}
      {...props}
    />
  );
}
