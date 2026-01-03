import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

const textAreaVariants = cva(
  cn(
    "w-full rounded-mdt-md border border-mdt-border bg-mdt-surface text-mdt-text placeholder:text-mdt-muted",
    "hover:border-[color:var(--mdt-color-border-strong)] focus-visible:border-[color:var(--mdt-color-border-strong)] focus-visible:shadow-mdt-sm aria-invalid:border-[color:var(--mdt-color-danger)] aria-invalid:focus-visible:ring-[color:var(--mdt-color-danger)]",
    "disabled:bg-mdt-surface-subtle disabled:text-mdt-muted",
    interactiveBase,
    focusRing
  ),
  {
    variants: {
      size: {
        xs: "px-mdt-2 py-mdt-1 text-caption",
        sm: "px-mdt-3 py-mdt-2 text-body-sm",
        md: "px-mdt-4 py-mdt-2 text-body-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof textAreaVariants>;

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, rows = 4, size, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        textAreaVariants({ size }),
        className
      )}
      {...props}
    />
  );
});
