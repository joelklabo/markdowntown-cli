import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { ATLAS_FEATURES } from "@/lib/atlas/features";
import { listAtlasPlatforms, loadAtlasFacts } from "@/lib/atlas/load";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import type { FeatureSupportLevel } from "@/lib/atlas/types";

export const dynamic = "force-dynamic";

function isoDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function featureTone(level: FeatureSupportLevel): React.ComponentProps<typeof Pill>["tone"] {
  if (level === "yes") return "green";
  if (level === "partial") return "yellow";
  return "gray";
}

function featureLabel(level: FeatureSupportLevel) {
  if (level === "yes") return "Yes";
  if (level === "partial") return "Partial";
  return "No";
}

export default function AtlasPlatformsPage() {
  const platforms = listAtlasPlatforms();

  return (
    <main className="py-mdt-2">
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading level="h1">Platforms</Heading>
          <Text tone="muted">Facts files live under atlas/facts/.</Text>
        </Stack>

        {platforms.length === 0 ? (
          <Text tone="muted">No platform facts found yet.</Text>
        ) : (
          <div className="grid gap-mdt-3">
            {platforms.map((platformId) => {
              const facts = loadAtlasFacts(platformId);
              const lastVerified = isoDate(facts.lastVerified);
              return (
                <Link
                  key={platformId}
                  href={`/atlas/platforms/${platformId}`}
                  className={cn(
                    "rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm hover:bg-mdt-surface-raised",
                    interactiveBase,
                    focusRing
                  )}
                >
                  <div className="flex flex-col gap-mdt-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-body-sm font-semibold text-mdt-text">{facts.name}</div>
                      <div className="mt-mdt-1 text-caption text-mdt-muted">
                        <span className="font-mono text-mdt-text">{platformId}</span>
                        <span className="mx-mdt-2" aria-hidden>
                          ·
                        </span>
                        <span>Last verified</span>
                        <span className="ml-mdt-2 font-mono text-mdt-text">{lastVerified ?? "—"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-mdt-2">
                      {ATLAS_FEATURES.map((feature) => {
                        const level = (facts.featureSupport?.[feature.id] ?? "no") as FeatureSupportLevel;
                        return (
                          <Pill key={feature.id} tone={featureTone(level)}>
                            {feature.label}: {featureLabel(level)}
                          </Pill>
                        );
                      })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Stack>
    </main>
  );
}
