import { ArtifactTable } from "@/components/atlas/ArtifactTable";
import { ClaimList } from "@/components/atlas/ClaimList";
import { ExamplesPanel } from "@/components/atlas/ExamplesPanel";
import { PlatformHeader } from "@/components/atlas/PlatformHeader";
import { SpecCards } from "@/components/atlas/SpecCards";
import { Stack } from "@/components/ui/Stack";
import { listAtlasExamples, loadAtlasFacts } from "@/lib/atlas/load";
import { AtlasPlatformIdSchema } from "@/lib/atlas/schema";
import type { AtlasPlatformId } from "@/lib/atlas/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PlatformParams = { platformId: string };

function defaultTargetIdForPlatform(platformId: AtlasPlatformId): string {
  if (platformId === "github-copilot") return "github-copilot";
  if (platformId === "claude-code") return "claude-code";
  if (platformId === "gemini-cli") return "gemini-cli";
  if (platformId === "cursor") return "cursor-rules";
  if (platformId === "windsurf") return "windsurf-rules";
  return "agents-md";
}

export default async function AtlasPlatformPage({ params }: { params: Promise<PlatformParams> }) {
  const { platformId: platformIdParam } = await params;
  const parsed = AtlasPlatformIdSchema.safeParse(platformIdParam);
  if (!parsed.success) return notFound();

  const platformId = parsed.data;

  const facts = (() => {
    try {
      return loadAtlasFacts(platformId);
    } catch {
      return null;
    }
  })();

  if (!facts) return notFound();

  const examples = listAtlasExamples(platformId);
  const defaultTargetId = defaultTargetIdForPlatform(platformId);
  const baselineExampleId = examples.length > 0 ? `${platformId}/${examples[0]!.fileName}` : null;
  const zipFiles = examples.map((example) => ({ platformId, fileName: example.fileName }));

  return (
    <main className="py-mdt-2">
      <Stack gap={4}>
        <PlatformHeader
          facts={facts}
          baselineExampleId={baselineExampleId}
          defaultTargetId={defaultTargetId}
          zipFiles={zipFiles}
        />
        <SpecCards featureSupport={facts.featureSupport} />
        <ArtifactTable artifacts={facts.artifacts} />
        <ClaimList claims={facts.claims} />
        <ExamplesPanel platformId={platformId} defaultTargetId={defaultTargetId} examples={examples} />
      </Stack>
    </main>
  );
}
