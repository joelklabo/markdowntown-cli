import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

const selectVariants = cva(
  cn(
    "w-full appearance-none rounded-mdt-md border border-mdt-border bg-mdt-surface text-mdt-text placeholder:text-mdt-muted",
    "hover:border-[color:var(--mdt-color-border-strong)] focus-visible:border-[color:var(--mdt-color-primary)] focus-visible:shadow-mdt-sm aria-invalid:border-[color:var(--mdt-color-danger)] aria-invalid:focus-visible:ring-[color:var(--mdt-color-danger)]",
    "disabled:bg-mdt-surface-subtle disabled:text-mdt-muted",
    "bg-[right_0.65rem_center] bg-no-repeat",
    interactiveBase,
    focusRing
  ),
  {
    variants: {
      size: {
        xs: "h-mdt-8 px-mdt-2 py-mdt-1 pr-mdt-9 text-caption",
        sm: "h-mdt-10 px-mdt-3 py-mdt-2 pr-mdt-9 text-body-sm",
        md: "h-mdt-11 px-mdt-4 py-mdt-2 pr-mdt-10 text-body-sm",
        lg: "h-mdt-12 px-mdt-4 py-mdt-2 pr-mdt-10 text-body",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> &
  VariantProps<typeof selectVariants>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        selectVariants({ size }),
        className
      )}
      style={{
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%), linear-gradient(to right, transparent, transparent)",
        backgroundPosition:
          "calc(100% - var(--mdt-space-5)) 55%, calc(100% - var(--mdt-space-4)) 55%, 0 0",
        backgroundSize: "6px 6px, 6px 6px, 2.5em 2.5em",
      }}
      {...props}
    >
      {children}
    </select>
  );
});
