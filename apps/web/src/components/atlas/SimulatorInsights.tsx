import Link from "next/link";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { formatInsightsSummary } from "@/lib/atlas/simulators/insights";
import type { ShadowedFile, SimulatorInsights as SimulatorInsightsData } from "@/lib/atlas/simulators/types";

type SimulatorInsightsProps = {
  insights: SimulatorInsightsData;
  shadowedFiles: ShadowedFile[];
};

export function SimulatorInsights({ insights, shadowedFiles }: SimulatorInsightsProps) {
  const summary = formatInsightsSummary(insights, shadowedFiles.length);
  const nextStepText = summary.nextStep.replace(/^next step:\s*/i, "");

  return (
    <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
      <Stack gap={3}>
        <Text as="h3" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
          Insights
        </Text>

        <Stack gap={3}>
          <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              What we found
            </Text>
            <Stack gap={1}>
              <Text size="bodySm" weight="semibold">{summary.title}</Text>
              <Text tone="muted" size="bodySm">{summary.body}</Text>
              <Text size="bodySm" weight="semibold">
                Next step: {nextStepText}
              </Text>
              {summary.note ? <Text tone="muted" size="bodySm">{summary.note}</Text> : null}
            </Stack>
          </div>

          <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              Missing instruction files
            </Text>
            <Text tone="muted" size="bodySm">
              These patterns were expected but not found. Add the files or use Next steps to copy a template.
            </Text>
            {insights.missingFiles.length === 0 ? (
              <Text tone="muted" size="bodySm">No missing instruction files detected.</Text>
            ) : (
              <ul className="space-y-mdt-2" aria-label="Missing instruction files">
                {insights.missingFiles.map((item) => (
                  <li key={item.id} className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                    <div className="text-body-sm font-semibold text-mdt-text">{item.label}</div>
                    <div className="font-mono text-body-xs text-mdt-muted">{item.pattern}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              Shadowed or overridden files
            </Text>
            <Text tone="muted" size="bodySm">
              These files exist but do not load for the selected tool. Review the reason and switch tools if needed.
            </Text>
            {shadowedFiles.length === 0 ? (
              <Text tone="muted" size="bodySm">No shadowed instruction files detected for this tool.</Text>
            ) : (
              <ul className="space-y-mdt-2" aria-label="Shadowed instruction files">
                {shadowedFiles.map((file) => (
                  <li key={file.path} className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                    <div className="font-mono text-body-sm text-mdt-text">{file.path}</div>
                    <div className="text-body-xs text-mdt-muted">{file.reason}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              Expected patterns
            </Text>
            <Text tone="muted" size="bodySm">
              These are the locations this tool checks. Add files here to be loaded.{" "}
              <Link href="/docs" className="text-mdt-text underline underline-offset-2">
                Atlas Simulator guide
              </Link>
              .
            </Text>
            {insights.expectedPatterns.length === 0 ? (
              <Text tone="muted" size="bodySm">No expected patterns available.</Text>
            ) : (
              <ul className="space-y-mdt-2" aria-label="Expected patterns">
                {insights.expectedPatterns.map((pattern) => (
                  <li key={pattern.id} className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                    <div className="text-body-sm font-semibold text-mdt-text">{pattern.label}</div>
                    <div className="font-mono text-body-xs text-mdt-muted">{pattern.pattern}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
            <Text as="h4" size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              Precedence notes
            </Text>
            <Text tone="muted" size="bodySm">
              Shows which file wins when multiple matches apply.{" "}
              <Link href="/docs" className="text-mdt-text underline underline-offset-2">
                Learn more in Docs
              </Link>
              .
            </Text>
            {insights.precedenceNotes.length === 0 ? (
              <Text tone="muted" size="bodySm">No precedence notes for this tool.</Text>
            ) : (
              <ul className="space-y-mdt-2" aria-label="Precedence notes">
                {insights.precedenceNotes.map((note, index) => (
                  <li key={`${note}-${index}`} className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                    <div className="text-body-sm text-mdt-text">{note}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Stack>
      </Stack>
    </div>
  );
}
