"use client";

import React from "react";
import { PathChip } from "@/components/atlas/PathChip";
import type { AtlasCrosswalk, AtlasFeature } from "@/lib/atlas/features";
import type { AtlasPlatformId } from "@/lib/atlas/types";

type CrosswalkSectionProps = {
  features: readonly AtlasFeature[];
  crosswalk: AtlasCrosswalk;
  selectedPlatforms: readonly AtlasPlatformId[];
};

export function CrosswalkSection({ features, crosswalk, selectedPlatforms }: CrosswalkSectionProps) {
  return (
    <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
      <div className="text-body-sm font-semibold text-mdt-text">Equivalent artifacts</div>
      <div className="mt-mdt-2 text-body-xs text-mdt-muted">
        Crosswalk entries from <span className="font-mono">atlas/crosswalk.json</span>.
      </div>

      <div className="mt-mdt-4 space-y-mdt-4">
        {features.map((feature) => {
          const row = crosswalk.crosswalk[feature.id];
          if (!row) return null;
          return (
            <div key={feature.id} className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <div className="flex items-center justify-between gap-mdt-3">
                <div className="text-body-sm font-medium text-mdt-text">{feature.label}</div>
                <div className="font-mono text-caption text-mdt-muted">{feature.id}</div>
              </div>
              <div className="mt-mdt-3 grid gap-mdt-3 md:grid-cols-2">
                {selectedPlatforms.map((platformId) => {
                  const items = row[platformId] ?? [];
                  return (
                    <div key={platformId} className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-mdt-3">
                      <div className="font-mono text-caption text-mdt-muted">{platformId}</div>
                      <div className="mt-mdt-2 flex flex-wrap gap-mdt-2">
                        {items.length > 0 ? (
                          items.map((item) => <PathChip key={item} path={item} />)
                        ) : (
                          <div className="text-body-xs text-mdt-muted">—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

