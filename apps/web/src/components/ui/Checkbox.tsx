import * as React from "react";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, children, ...props },
  ref
) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-mdt-2 text-body-sm text-mdt-text",
        props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
    >
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "h-mdt-5 w-mdt-5 shrink-0 cursor-pointer appearance-none rounded-mdt-sm border border-mdt-border bg-mdt-surface hover:border-mdt-border-strong hover:bg-mdt-surface-subtle",
          interactiveBase,
          focusRing,
          "checked:border-transparent checked:bg-[color:var(--mdt-color-primary)] checked:shadow-mdt-sm",
          className
        )}
        style={{ accentColor: "var(--mdt-color-primary)" }}
        {...props}
      />
      {children ? <span>{children}</span> : null}
    </label>
  );
});
