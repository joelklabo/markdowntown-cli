import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

const inputVariants = cva(
  cn(
    "w-full rounded-mdt-md border border-mdt-border bg-mdt-surface text-mdt-text placeholder:text-mdt-muted",
    "hover:border-[color:var(--mdt-color-border-strong)] focus-visible:border-[color:var(--mdt-color-primary)] focus-visible:shadow-mdt-sm aria-invalid:border-[color:var(--mdt-color-danger)] aria-invalid:focus-visible:ring-[color:var(--mdt-color-danger)]",
    "disabled:bg-mdt-surface-subtle disabled:text-mdt-muted",
    interactiveBase,
    focusRing
  ),
  {
    variants: {
      size: {
        xs: "h-mdt-8 px-mdt-2 py-mdt-1 text-caption",
        sm: "h-mdt-10 px-mdt-3 py-mdt-2 text-body-sm",
        md: "h-mdt-11 px-mdt-4 py-mdt-2 text-body-sm",
        lg: "h-mdt-12 px-mdt-4 py-mdt-2 text-body",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", size, ...props },
  ref
) {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        inputVariants({ size }),
        className
      )}
      {...props}
    />
  );
});
