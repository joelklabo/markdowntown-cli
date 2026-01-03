'use client';

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const LEGEND_PATTERNS = {
  car: ["111", "101", "111"],
  truck: ["111", "111", "110"],
  pedestrian: ["010", "111", "010"],
  dog: ["110", "011", "000"],
  ambulance: ["111", "101", "111"],
} as const;

type LegendIconName = keyof typeof LEGEND_PATTERNS;

type LegendItem = {
  id: string;
  label: string;
  detail: string;
  icon: LegendIconName;
};

const LEGEND_ITEMS: LegendItem[] = [
  { id: "search", label: "Search", detail: "Cars stream through", icon: "car" },
  { id: "command", label: "Command palette", detail: "Pedestrians gather", icon: "pedestrian" },
  { id: "login", label: "Login", detail: "Commuters appear", icon: "pedestrian" },
  { id: "publish", label: "Publish", detail: "Delivery trucks roll by", icon: "truck" },
  { id: "upload", label: "Upload", detail: "Dog walkers show up", icon: "dog" },
  { id: "alert", label: "Alert", detail: "Ambulance lights flare", icon: "ambulance" },
];

function LegendIcon({ icon, className }: { icon: LegendIconName; className?: string }) {
  const rows = LEGEND_PATTERNS[icon];
  return (
    <span className={cn("mdt-wordmark-legend-icon", `mdt-wordmark-legend-icon--${icon}`, className)} aria-hidden>
      {rows.map((row, rowIndex) =>
        row.split("").map((cell, colIndex) => (
          <span
            key={`${rowIndex}-${colIndex}`}
            className="mdt-wordmark-legend-dot"
            data-active={cell === "1" ? "true" : undefined}
          />
        ))
      )}
    </span>
  );
}

export function WordmarkLegend({ className, defaultOpen = true }: { className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <Card className={cn("p-mdt-4 space-y-mdt-3", className)} role="region" aria-label="Wordmark legend">
      <div className="flex items-center justify-between gap-mdt-2">
        <div className="text-body-sm font-medium text-mdt-text">Legend</div>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      <div id={contentId} hidden={!open} className="space-y-mdt-3">
        <p className="text-caption text-mdt-muted">
          Events map to animated city cues. Trigger an event and look for the matching signal.
        </p>
        <dl className="grid gap-mdt-3 sm:grid-cols-2">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.id} className="flex items-start gap-mdt-3">
              <LegendIcon icon={item.icon} className="mt-0.5" />
              <div>
                <dt className="text-body-sm font-medium text-mdt-text">{item.label}</dt>
                <dd className="text-caption text-mdt-muted">{item.detail}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
