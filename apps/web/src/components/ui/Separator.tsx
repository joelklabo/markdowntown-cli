import * as React from "react";
import { cn } from "@/lib/cn";

export type SeparatorOrientation = "horizontal" | "vertical";

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: SeparatorOrientation;
};

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { orientation = "horizontal", className, ...props },
  ref
) {
  const orientationClass =
    orientation === "vertical" ? "w-px self-stretch" : "h-px w-full";

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cn("shrink-0 rounded-full bg-mdt-border opacity-70", orientationClass, className)}
      {...props}
    />
  );
});
