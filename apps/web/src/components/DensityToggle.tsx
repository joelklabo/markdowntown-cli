"use client";

import { useDensity } from "@/providers/DensityProvider";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";

type DensityToggleMode = "full" | "icon";

export function DensityToggle({ mode = "full" }: { mode?: DensityToggleMode }) {
  const { density, toggleDensity } = useDensity();
  const isCompact = density === "compact";
  const label = isCompact ? "Compact" : "Comfortable";

  const content = (
    <Button
      variant="ghost"
      size="xs"
      type="button"
      aria-pressed={isCompact}
      aria-label={`Switch to ${isCompact ? "comfortable" : "compact"} density`}
      onClick={toggleDensity}
      className="gap-mdt-1"
    >
      <span aria-hidden>↕</span>
      {mode === "full" ? <span>{`Density: ${label}`}</span> : <span className="sr-only">{`Density: ${label}`}</span>}
    </Button>
  );

  if (mode === "icon") {
    return <Tooltip content={`Density: ${label}`}>{content}</Tooltip>;
  }

  return content;
}
