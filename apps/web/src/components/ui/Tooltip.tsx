import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";
import React from "react";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "center" | "start" | "end";
};

export function Tooltip({ content, children, side = "top", align = "center" }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={120}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cn(
              "mdt-radix-panel-scale",
              "z-50 rounded-mdt-md border border-mdt-border bg-mdt-surface-raised px-mdt-3 py-mdt-2 text-caption font-medium text-mdt-text shadow-mdt-md",
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[color:var(--mdt-color-surface-raised)]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
