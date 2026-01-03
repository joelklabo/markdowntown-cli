"use client";

import React from "react";
import { cn, focusRing } from "@/lib/cn";
import type { AtlasPlatformId } from "@/lib/atlas/types";

type ComparePickerProps = {
  availablePlatforms: AtlasPlatformId[];
  selectedPlatforms: AtlasPlatformId[];
  onChange: (next: AtlasPlatformId[]) => void;
  min?: number;
  max?: number;
  className?: string;
};

export function ComparePicker({
  availablePlatforms,
  selectedPlatforms,
  onChange,
  min = 2,
  max = 5,
  className,
}: ComparePickerProps) {
  function toggle(platformId: AtlasPlatformId) {
    const selected = new Set(selectedPlatforms);
    if (selected.has(platformId)) {
      if (selectedPlatforms.length <= min) return;
      selected.delete(platformId);
    } else {
      if (selectedPlatforms.length >= max) return;
      selected.add(platformId);
    }
    onChange(Array.from(selected));
  }

  const disableAdd = selectedPlatforms.length >= max;
  const disableRemove = selectedPlatforms.length <= min;

  return (
    <fieldset
      className={cn("rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm", className)}
    >
      <legend className="text-body-sm font-semibold text-mdt-text">Platforms</legend>
      <div className="mt-mdt-2 text-body-xs text-mdt-muted">
        Select {min}–{max} platforms to compare.
      </div>

      <div className="mt-mdt-3 grid gap-mdt-2 sm:grid-cols-2">
        {availablePlatforms.map((platformId) => {
          const checked = selectedPlatforms.includes(platformId);
          const disabled = checked ? disableRemove : disableAdd;
          return (
            <label
              key={platformId}
              className={cn(
                "flex items-center gap-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-body-sm text-mdt-text",
                disabled ? "opacity-60" : "hover:bg-mdt-surface-raised"
              )}
            >
              <input
                type="checkbox"
                aria-label={`Select ${platformId}`}
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(platformId)}
                className={cn("h-4 w-4 rounded border-mdt-border", focusRing)}
              />
              <span className="font-mono text-[12px]">{platformId}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

