import { Pill } from "@/components/ui/Pill";
import { ATLAS_FEATURES } from "@/lib/atlas/features";
import type { FeatureSupportLevel } from "@/lib/atlas/types";

type SpecCardsProps = {
  featureSupport: Record<string, FeatureSupportLevel>;
};

function supportTone(level: FeatureSupportLevel): React.ComponentProps<typeof Pill>["tone"] {
  if (level === "yes") return "green";
  if (level === "partial") return "yellow";
  return "gray";
}

function supportLabel(level: FeatureSupportLevel) {
  if (level === "yes") return "Yes";
  if (level === "partial") return "Partial";
  return "No";
}

export function SpecCards({ featureSupport }: SpecCardsProps) {
  return (
    <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
      <div className="text-body-sm font-semibold text-mdt-text">Spec</div>
      <div className="mt-mdt-2 text-body-xs text-mdt-muted">High-level support signals for key behaviors.</div>

      <div className="mt-mdt-4 grid gap-mdt-3 md:grid-cols-3">
        {ATLAS_FEATURES.map((feature) => {
          const level = (featureSupport?.[feature.id] ?? "no") as FeatureSupportLevel;
          return (
            <div key={feature.id} className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <div className="flex items-start justify-between gap-mdt-3">
                <div>
                  <div className="text-body-sm font-medium text-mdt-text">{feature.label}</div>
                  <div className="mt-mdt-1 font-mono text-caption text-mdt-muted">{feature.id}</div>
                </div>
                <Pill tone={supportTone(level)}>{supportLabel(level)}</Pill>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
