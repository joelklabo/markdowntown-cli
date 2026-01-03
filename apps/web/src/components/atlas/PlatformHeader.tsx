import { EvidenceBadge } from "@/components/atlas/EvidenceBadge";
import { DownloadExamplesZipButton } from "@/components/atlas/DownloadExamplesZipButton";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import type { AtlasPlatformId } from "@/lib/atlas/types";
import type { PlatformFacts } from "@/lib/atlas/types";
import Link from "next/link";

function isoDate(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

type PlatformHeaderProps = {
  facts: PlatformFacts;
  baselineExampleId: string | null;
  defaultTargetId: string;
  zipFiles: Array<{ platformId: AtlasPlatformId; fileName: string }>;
};

export function PlatformHeader({ facts, baselineExampleId, defaultTargetId, zipFiles }: PlatformHeaderProps) {
  const lastVerified = isoDate(facts.lastVerified);
  const translateHref = baselineExampleId
    ? `/translate?target=${encodeURIComponent(defaultTargetId)}&example=${encodeURIComponent(baselineExampleId)}`
    : `/translate?target=${encodeURIComponent(defaultTargetId)}`;

  const workbenchHref = baselineExampleId ? `/workbench?templateId=${encodeURIComponent(baselineExampleId)}` : null;

  return (
    <header className="space-y-mdt-3">
      <Row gap={2} align="center" wrap className="text-body-xs text-mdt-muted">
        <span className="font-mono text-mdt-text">{facts.platformId}</span>
        <span aria-hidden>·</span>
        <span>Last verified</span>
        {lastVerified ? (
          <time dateTime={facts.lastVerified} className="font-mono text-mdt-text">
            {lastVerified}
          </time>
        ) : (
          <span className="font-mono text-mdt-text" aria-label="Last verified unknown">
            —
          </span>
        )}
        {facts.docHome ? <EvidenceBadge url={facts.docHome} label="Docs" /> : null}
      </Row>

      <Stack gap={2}>
        <Heading level="h1">{facts.name}</Heading>
        <Text tone="muted">
          Platform facts from <span className="font-mono">atlas/facts/{facts.platformId}.json</span>.
        </Text>
      </Stack>

      <Row gap={2} wrap>
        <Button asChild size="sm" variant="secondary">
          <Link href={translateHref}>Open in Translate</Link>
        </Button>
        {workbenchHref ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={workbenchHref}>Open baseline template in Workbench</Link>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled>
            Open baseline template in Workbench
          </Button>
        )}
        <DownloadExamplesZipButton files={zipFiles} downloadName={`atlas-${facts.platformId}-examples.zip`} />
      </Row>
    </header>
  );
}
