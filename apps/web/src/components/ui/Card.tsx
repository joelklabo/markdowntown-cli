import { cn } from "@/lib/cn";
import React from "react";
import type { SurfaceProps } from "./Surface";
import { Surface } from "./Surface";

export function Card({
  className,
  tone = "raised",
  padding = "md",
  ...props
}: SurfaceProps<"div">) {
  return (
    <Surface
      className={cn(
        "transition duration-mdt-base ease-mdt-emphasized motion-reduce:transition-none",
        tone === "raised"
          ? "hover:shadow-mdt-md hover:border-mdt-border-strong active:shadow-mdt-sm active:border-mdt-border-strong"
          : undefined,
        className
      )}
      tone={tone}
      padding={padding}
      {...props}
    />
  );
}
