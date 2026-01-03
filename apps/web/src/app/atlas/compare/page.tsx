import { CompareMatrix } from "@/components/atlas/CompareMatrix";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { ATLAS_FEATURES } from "@/lib/atlas/features";
import { listAtlasPlatforms, loadAtlasCrosswalk, loadAtlasFacts } from "@/lib/atlas/load";
import type { AtlasPlatformId, PlatformFacts } from "@/lib/atlas/types";

export const dynamic = "force-dynamic";

export default async function AtlasComparePage() {
  const platforms = listAtlasPlatforms();

  if (platforms.length < 2) {
    return (
      <main className="py-mdt-2">
        <Stack gap={3}>
          <Heading level="h1">Compare</Heading>
          <Text tone="muted">Add at least two platform facts files under atlas/facts/ to enable compare.</Text>
        </Stack>
      </main>
    );
  }

  const factsByPlatform = Object.fromEntries(
    platforms.map((platformId) => [platformId, loadAtlasFacts(platformId)]),
  ) as Record<AtlasPlatformId, PlatformFacts>;

  const crosswalk = loadAtlasCrosswalk();

  return (
    <main className="py-mdt-2">
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading level="h1">Compare</Heading>
          <Text tone="muted">Compare feature support across platforms. Click a cell for claims.</Text>
        </Stack>
        <CompareMatrix
          availablePlatforms={platforms}
          factsByPlatform={factsByPlatform}
          features={ATLAS_FEATURES}
          crosswalk={crosswalk}
        />
      </Stack>
    </main>
  );
}

