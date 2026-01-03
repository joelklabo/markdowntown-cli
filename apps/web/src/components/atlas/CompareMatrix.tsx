"use client";

import React from "react";
import { ComparePicker } from "@/components/atlas/ComparePicker";
import { EvidenceBadge } from "@/components/atlas/EvidenceBadge";
import { CrosswalkSection } from "@/components/atlas/CrosswalkSection";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import type { AtlasFeature, AtlasFeatureId, AtlasCrosswalk } from "@/lib/atlas/features";
import type { AtlasPlatformId, FeatureSupportLevel, PlatformFacts } from "@/lib/atlas/types";

type CompareMatrixProps = {
  availablePlatforms: AtlasPlatformId[];
  factsByPlatform: Record<AtlasPlatformId, PlatformFacts>;
  features: readonly AtlasFeature[];
  crosswalk: AtlasCrosswalk;
};

type SelectedCell = { platformId: AtlasPlatformId; featureId: AtlasFeatureId } | null;

function supportLabel(level: FeatureSupportLevel) {
  if (level === "yes") return "Yes";
  if (level === "partial") return "Partial";
  return "No";
}

function supportTone(level: FeatureSupportLevel) {
  if (level === "yes") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (level === "partial") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-rose-500/10 text-rose-700 border-rose-500/20";
}

export function CompareMatrix({ availablePlatforms, factsByPlatform, features, crosswalk }: CompareMatrixProps) {
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<AtlasPlatformId[]>(() =>
    availablePlatforms.slice(0, Math.min(2, availablePlatforms.length))
  );
  const [selectedCell, setSelectedCell] = React.useState<SelectedCell>(null);

  const selectedFacts = React.useMemo(() => {
    const out: Record<AtlasPlatformId, PlatformFacts> = {} as Record<AtlasPlatformId, PlatformFacts>;
    for (const platformId of selectedPlatforms) {
      out[platformId] = factsByPlatform[platformId];
    }
    return out;
  }, [factsByPlatform, selectedPlatforms]);

  const drilldown = React.useMemo(() => {
    if (!selectedCell) return null;
    const facts = selectedFacts[selectedCell.platformId];
    const claims = facts.claims.filter((claim) => (claim.features ?? []).includes(selectedCell.featureId));
    return { facts, claims };
  }, [selectedCell, selectedFacts]);

  return (
    <div className="space-y-mdt-6">
      <ComparePicker
        availablePlatforms={availablePlatforms}
        selectedPlatforms={selectedPlatforms}
        onChange={(next) => {
          const normalized = next.slice().sort();
          setSelectedPlatforms(normalized);
          setSelectedCell(null);
        }}
      />

      <div className="rounded-mdt-xl border border-mdt-border bg-mdt-surface shadow-mdt-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-mdt-surface-subtle">
              <tr>
                <th className="px-mdt-4 py-mdt-3 text-left text-body-xs font-semibold text-mdt-muted">
                  Feature
                </th>
                {selectedPlatforms.map((platformId) => (
                  <th
                    key={platformId}
                    className="px-mdt-4 py-mdt-3 text-left text-body-xs font-semibold text-mdt-muted"
                  >
                    <span className="font-mono">{platformId}</span>
                    <span className="ml-mdt-2 text-mdt-text">{factsByPlatform[platformId]?.name ?? ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.id} className="border-t border-mdt-border">
                  <td className="px-mdt-4 py-mdt-3">
                    <div className="text-body-sm font-medium text-mdt-text">{feature.label}</div>
                    <div className="mt-1 font-mono text-caption text-mdt-muted">{feature.id}</div>
                  </td>
                  {selectedPlatforms.map((platformId) => {
                    const facts = factsByPlatform[platformId];
                    const level = (facts.featureSupport?.[feature.id] ?? "no") as FeatureSupportLevel;
                    const active =
                      selectedCell?.platformId === platformId && selectedCell?.featureId === feature.id;
                    return (
                      <td key={`${feature.id}:${platformId}`} className="px-mdt-4 py-mdt-3 align-top">
                        <button
                          type="button"
                          onClick={() => setSelectedCell({ platformId, featureId: feature.id })}
                          className={cn(
                            "w-full rounded-mdt-lg border px-mdt-3 py-mdt-2 text-left",
                            supportTone(level),
                            interactiveBase,
                            focusRing,
                            active
                              ? "ring-2 ring-mdt-ring ring-offset-2 ring-offset-[color:var(--mdt-color-bg)]"
                              : ""
                          )}
                          aria-label={`Show details for ${feature.id} on ${platformId}`}
                        >
                          <div className="text-body-sm font-semibold">{supportLabel(level)}</div>
                          <div className="mt-1 text-body-xs opacity-80">Click for claims</div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
        <div className="flex items-center justify-between gap-mdt-3">
          <div className="text-body-sm font-semibold text-mdt-text">Cell drilldown</div>
          {selectedCell ? (
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              className={cn(
                "rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-body-xs text-mdt-text hover:bg-mdt-surface-raised",
                interactiveBase,
                focusRing
              )}
            >
              Clear
            </button>
          ) : null}
        </div>

        {!selectedCell ? (
          <div className="mt-mdt-3 text-body-sm text-mdt-muted">Select a matrix cell to view claims.</div>
        ) : (
          <div className="mt-mdt-4 space-y-mdt-3">
            <div className="text-body-sm text-mdt-muted">
              <span className="font-mono text-mdt-text">{selectedCell.platformId}</span>
              <span className="mx-mdt-2">·</span>
              <span className="font-mono text-mdt-text">{selectedCell.featureId}</span>
            </div>

            {drilldown && drilldown.claims.length > 0 ? (
              <ul className="space-y-mdt-3">
                {drilldown.claims.map((claim) => (
                  <li
                    key={claim.id}
                    className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3"
                  >
                    <div className="flex items-center justify-between gap-mdt-3">
                      <div className="text-body-sm font-medium text-mdt-text">{claim.statement}</div>
                      <div className="text-caption text-mdt-muted">{claim.confidence}</div>
                    </div>
                    <div className="mt-mdt-2 flex flex-wrap gap-mdt-2">
                      {claim.evidence.map((evidence) => (
                        <EvidenceBadge
                          key={evidence.url}
                          url={evidence.url}
                          label={evidence.title ?? undefined}
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-body-sm text-mdt-muted">No claims tagged with this feature yet.</div>
            )}
          </div>
        )}
      </section>

      <CrosswalkSection features={features} crosswalk={crosswalk} selectedPlatforms={selectedPlatforms} />
    </div>
  );
}
