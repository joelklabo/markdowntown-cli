import { CopyButton } from "@/components/atlas/CopyButton";
import { DownloadExamplesZipButton } from "@/components/atlas/DownloadExamplesZipButton";
import { PathChip } from "@/components/atlas/PathChip";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { AtlasExample } from "@/lib/atlas/load";
import type { AtlasPlatformId } from "@/lib/atlas/types";
import Link from "next/link";

type ExamplesPanelProps = {
  platformId: AtlasPlatformId;
  defaultTargetId: string;
  examples: AtlasExample[];
};

export function ExamplesPanel({ platformId, defaultTargetId, examples }: ExamplesPanelProps) {
  const zipFiles = examples.map((example) => ({ platformId, fileName: example.fileName }));

  return (
    <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
      <div className="flex items-center justify-between gap-mdt-3">
        <div className="text-body-sm font-semibold text-mdt-text">Examples</div>
        <div className="flex items-center gap-mdt-2">
          <div className="text-caption text-mdt-muted">{examples.length}</div>
          <DownloadExamplesZipButton files={zipFiles} downloadName={`atlas-${platformId}-examples.zip`} />
        </div>
      </div>
      <div className="mt-mdt-2 text-body-xs text-mdt-muted">Snippets under atlas/examples/&lt;platformId&gt;/.</div>

      {examples.length === 0 ? (
        <Text className="mt-mdt-3" size="bodySm" tone="muted">
          No examples yet.
        </Text>
      ) : (
        <div className="mt-mdt-4 space-y-mdt-4">
          {examples.map((example) => (
            <div
              key={example.fileName}
              className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3"
            >
              <div className="flex items-center justify-between gap-mdt-3">
                <PathChip path={example.fileName} />
                <div className="flex items-center gap-mdt-2">
                  <Button asChild variant="secondary" size="xs">
                    <Link
                      href={`/translate?target=${encodeURIComponent(defaultTargetId)}&example=${encodeURIComponent(
                        `${platformId}/${example.fileName}`
                      )}`}
                    >
                      Translate
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="xs">
                    <Link href={`/workbench?templateId=${encodeURIComponent(`${platformId}/${example.fileName}`)}`}>
                      Workbench
                    </Link>
                  </Button>
                  <CopyButton
                    text={example.contents}
                    label="Copy"
                    variant="secondary"
                    size="xs"
                    aria-label={`Copy example ${example.fileName}`}
                  />
                </div>
              </div>
              <pre className="mt-mdt-3 max-h-[360px] overflow-auto rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-[11px] leading-relaxed text-mdt-text">
                <code>{example.contents}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
