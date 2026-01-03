"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics";

type StepKey = "search" | "add" | "export";

const DEFAULT_STEPS: { key: StepKey; label: string; desc: string }[] = [
  { key: "search", label: "Search", desc: "Find a snippet or template" },
  { key: "add", label: "Add to builder", desc: "Add at least one snippet" },
  { key: "export", label: "Export", desc: "Copy or download agents.md" },
];

const STORAGE_KEY = "mdt_onboarding_checklist";

export function OnboardingChecklist({ onLoadSample }: { onLoadSample: () => void }) {
  const [completed, setCompleted] = useState<Record<StepKey, boolean>>({ search: false, add: false, export: false });
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<StepKey, boolean>;
        const next = { search: Boolean(parsed.search), add: Boolean(parsed.add), export: Boolean(parsed.export) };
        queueMicrotask(() => {
          setCompleted(next);
          if (Object.values(next).every(Boolean)) setExpanded(false);
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    } catch {
      /* ignore */
    }
  }, [completed]);

  function toggle(step: StepKey, value: boolean) {
    setCompleted((prev) => {
      const next = { ...prev, [step]: value };
      track("onboarding_checklist_step", { step, completed: value });
      if (Object.values(next).every(Boolean)) {
        track("onboarding_checklist_complete");
      }
      return next;
    });
  }

  const doneCount = Object.values(completed).filter(Boolean).length;
  const allDone = doneCount === DEFAULT_STEPS.length;

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[300px] max-w-[90vw]">
      <Surface tone="raised" padding="md" className="space-y-mdt-3 shadow-mdt-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-caption text-mdt-muted">Guided steps</p>
            <p className="text-sm font-semibold text-mdt-text">Get to export fast ({doneCount}/3)</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Hide" : "Show"}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-2" role="list" aria-label="Onboarding checklist">
            {DEFAULT_STEPS.map((step) => {
              const isDone = completed[step.key];
              return (
                <button
                  key={step.key}
                  role="listitem"
                  className={cn(
                    "w-full rounded-mdt-sm border px-3 py-2 text-left text-sm transition",
                    isDone
                      ? "border-mdt-success bg-[color:var(--mdt-color-success)]/10 text-mdt-text"
                      : "border-mdt-border hover:border-mdt-border-strong"
                  )}
                  onClick={() => toggle(step.key, !isDone)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{step.label}</span>
                    <span className="text-xs text-mdt-muted">{isDone ? "Done" : "Tap to mark"}</span>
                  </div>
                  <p className="text-xs text-mdt-muted">{step.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onLoadSample}>
            Load sample project
          </Button>
          {allDone && <span className="text-xs text-mdt-success">Nice! Checklist complete.</span>}
        </div>
      </Surface>
    </div>
  );
}
