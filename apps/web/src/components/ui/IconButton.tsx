import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import React from "react";

const base = cn(
  "inline-flex items-center justify-center rounded-mdt-md border leading-none",
  interactiveBase,
  focusRing
);

const styles = cva(base, {
  variants: {
    variant: {
      primary:
        "bg-[color:var(--mdt-color-primary)] text-[color:var(--mdt-color-text-on-strong)] border-transparent shadow-mdt-btn hover:bg-[color:var(--mdt-color-primary-strong)] hover:shadow-mdt-btn-hover active:bg-[color:var(--mdt-color-primary-strong)] active:shadow-mdt-sm disabled:bg-[color:var(--mdt-color-primary-soft)] disabled:text-[color:var(--mdt-color-text-muted)] disabled:shadow-none",
      secondary:
        "bg-[color:var(--mdt-color-surface)] text-[color:var(--mdt-color-text)] border-[color:var(--mdt-color-border)] hover:bg-[color:var(--mdt-color-surface-strong)] hover:border-[color:var(--mdt-color-border-strong)] active:bg-[color:var(--mdt-color-surface-strong)] active:border-[color:var(--mdt-color-border-strong)] disabled:bg-[color:var(--mdt-color-surface-subtle)] disabled:text-[color:var(--mdt-color-text-muted)] disabled:border-[color:var(--mdt-color-border)]",
      ghost:
        "bg-transparent text-[color:var(--mdt-color-text)] border-transparent hover:bg-[color:var(--mdt-color-surface-subtle)] active:bg-[color:var(--mdt-color-surface-strong)] disabled:text-[color:var(--mdt-color-text-muted)] disabled:bg-transparent",
    },
    size: {
      xs: "h-mdt-8 w-mdt-8 text-caption",
      sm: "h-mdt-10 w-mdt-10 text-body-sm",
      md: "h-mdt-11 w-mdt-11 text-body",
      lg: "h-mdt-12 w-mdt-12 text-body",
    },
    shape: {
      rounded: "rounded-mdt-md",
      pill: "rounded-full",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "md",
    shape: "rounded",
  },
});

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof styles> {
  asChild?: boolean;
}

export function IconButton({ className, variant, size, shape, asChild, ...props }: IconButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(styles({ variant, size, shape }), className)} {...props} />;
}
