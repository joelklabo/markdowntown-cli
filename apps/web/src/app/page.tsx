import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LibraryCard } from "@/components/LibraryCard";
import { HomeCtaCluster } from "@/components/home/HomeCtaCluster";
import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { HomeStepList } from "@/components/home/HomeStepList";
import { HomeTrackedButton } from "@/components/home/HomeTrackedButton";
import type { SampleItem } from "@/lib/sampleContent";
import { listPublicItems, type PublicItem } from "@/lib/publicItems";
import { normalizeTags } from "@/lib/tags";
import { Container } from "@/components/ui/Container";
import { Stack, Row } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export const metadata: Metadata = {
  title: "mark downtown | Compose, remix, and ship agents.md fast",
  description: "Scan a repo to see which instructions load, then build and export agents.md with confidence.",
};

const buildSteps = [
  { title: "Scan a folder", description: "Run a local scan to see what loads." },
  { title: "Review what loads", description: "Spot missing or conflicting files fast." },
  { title: "Build & export agents.md", description: "Open Workbench and export." },
];

export default async function Home() {
  const publicItems = await listPublicItems({ limit: 60, sort: "recent", type: "all" });

  const toCard = (item: PublicItem): SampleItem => ({
    id: item.id,
    slug: item.slug ?? undefined,
    title: item.title,
    description: item.description || "Markdown snippet",
    tags: normalizeTags(item.tags, { strict: false }).tags,
    stats: item.stats,
    type: item.type,
  });

  const items: SampleItem[] = publicItems.map(toCard);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-mdt-bg text-mdt-text">
        <div className="relative overflow-hidden border-b border-mdt-border-strong bg-mdt-surface-raised">
          <Container size="lg" padding="lg" className="py-mdt-14 md:py-mdt-16">
            <Surface tone="raised" padding="lg" className="mx-auto max-w-3xl space-y-mdt-5 border-mdt-border-strong text-center shadow-mdt-lg">
              <Row justify="center">
                <Pill tone="yellow">Library empty</Pill>
              </Row>
              <Heading level="display" leading="tight" className="mx-auto max-w-[20ch]">
                Scan a folder to start
              </Heading>
              <Text tone="muted" className="mx-auto max-w-2xl">
                The Library is empty right now. Scan a repo to preview instruction files and open Workbench to export agents.md.
              </Text>
              <Row justify="center" gap={3} wrap>
                <HomeTrackedButton
                  label="Scan a folder"
                  href="/atlas/simulator"
                  ctaId="scan"
                  placement="empty-state"
                  slot="primary"
                  size="lg"
                />
                <HomeTrackedButton
                  label="Open Workbench"
                  href="/workbench"
                  ctaId="workbench"
                  placement="empty-state"
                  slot="secondary"
                  size="lg"
                  variant="secondary"
                />
              </Row>
              <Text size="caption" tone="muted">
                Tip: Make an artifact public to show it on the homepage.
              </Text>
            </Surface>
          </Container>
        </div>
      </div>
    );
  }

  const previewItems = items
    .slice()
    .sort((a, b) => b.stats.copies - a.stats.copies || b.stats.views - a.stats.views)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-mdt-bg text-mdt-text">
      <div className="relative overflow-hidden border-b border-mdt-border-strong bg-mdt-surface-raised">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,var(--mdt-color-primary-soft),transparent_60%)]"
          aria-hidden
        />

        <section className="relative">
          <Container
            size="lg"
            padding="lg"
            className="flex flex-col gap-mdt-10 pb-mdt-16 pt-mdt-12 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-mdt-12 md:pt-mdt-16"
          >
            <div className="space-y-mdt-6">
              <Row align="center" gap={2}>
                <Pill tone="yellow" className="uppercase tracking-wide">Scan-first</Pill>
                <Text size="caption" tone="muted">Local-only scan</Text>
              </Row>
              <Stack gap={3}>
                <Heading level="display" leading="tight" className="max-w-[22ch]">
                  Scan your repo. See what loads locally.
                </Heading>
                <Text tone="muted" className="max-w-2xl">
                  Local scan, clear insights, export agents.md in minutes.
                </Text>
                <Text size="caption" tone="muted">
                  Local-only scans. Nothing leaves your device.
                </Text>
              </Stack>

              <Card
                padding="lg"
                className="grid gap-mdt-5 border-mdt-border-strong shadow-mdt-lg sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <Stack gap={3}>
                  <Text size="caption" tone="muted">Start with scan</Text>
                  <Heading level="h3" as="h2">Scan a folder</Heading>
                  <Text size="bodySm" tone="muted">
                    See what loads locally, then open Workbench to export agents.md.
                  </Text>
                </Stack>
                <div className="space-y-mdt-2 sm:text-right">
                  <HomeCtaCluster
                    primary={{ id: "scan", label: "Scan a folder", href: "/atlas/simulator" }}
                    secondary={{ id: "workbench", label: "Open Workbench", href: "/workbench" }}
                    align="right"
                    placement="hero"
                  />
                </div>
              </Card>

            </div>

            <div className="relative">
              <Surface tone="raised" padding="lg" className="space-y-mdt-6 border-mdt-border-strong shadow-mdt-lg">
                <Row align="center" justify="between" gap={3}>
                  <Stack gap={1}>
                    <Text size="caption" tone="muted">After the scan</Text>
                    <Heading level="h3" as="h2">Ready-to-export output</Heading>
                  </Stack>
                  <HomeTrackedButton
                    label="Open Workbench"
                    href="/workbench"
                    ctaId="workbench"
                    placement="proof"
                    slot="secondary"
                    size="xs"
                    variant="secondary"
                  />
                </Row>
                <Surface tone="subtle" padding="md" className="space-y-mdt-4 border-mdt-border-strong">
                  <Row align="center" gap={2} className="text-body-sm text-mdt-muted">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--mdt-color-success)]" aria-hidden />
                    Sample output ready - autosave off for anon
                  </Row>
                  <div className="grid gap-mdt-2 md:grid-cols-2">
                    {[
                      { title: "Guardrails", subtitle: "sanitized markdown" },
                      { title: "Sections", subtitle: "structured blocks" },
                      { title: "Status", subtitle: "ready to export" },
                      { title: "Targets", subtitle: "agents.md" },
                    ].map((item) => (
                      <Surface key={item.title} padding="sm">
                        <Text size="bodySm" weight="semibold">{item.title}</Text>
                        <Text size="caption" tone="muted">{item.subtitle}</Text>
                      </Surface>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-mdt-2">
                    {["Local-only scan", "Linted output", "No login required", "Copy or export"].map((label) => (
                      <Pill key={label} tone="gray">
                        {label}
                      </Pill>
                    ))}
                  </div>
                  <div className="grid gap-mdt-2">
                    <div className="h-2 w-full rounded-md bg-[color:var(--mdt-color-primary-soft)]" />
                    <div className="h-2 w-[82%] rounded-md bg-[color:var(--mdt-color-success-soft)]" />
                    <div className="h-2 w-[64%] rounded-md bg-[color:var(--mdt-color-info-soft)]" />
                  </div>
                </Surface>
              </Surface>
            </div>
          </Container>
        </section>
      </div>

      <Container size="lg" padding="lg" className="pb-mdt-16 pt-mdt-12">
        <Stack gap={12}>
          <Surface
            as="section"
            id="build-in-60s"
            tone="raised"
            padding="lg"
            className="grid gap-mdt-6 border-mdt-border-strong shadow-mdt-md md:grid-cols-[1.4fr_1fr]"
          >
            <Stack gap={3}>
              <HomeSectionHeader
                eyebrow="Scan to export"
                title="A clear, scan-first path"
                description="Three steps from scan to export."
              />
              <HomeStepList steps={buildSteps} />
              <Row wrap gap={3}>
                <HomeTrackedButton
                  label="Open Workbench"
                  href="/workbench"
                  ctaId="workbench"
                  placement="build-steps"
                  slot="single"
                  variant="secondary"
                />
              </Row>
            </Stack>

            <Surface tone="subtle" padding="md" className="space-y-mdt-3 border-dashed border-mdt-border-strong">
              <Text size="caption" tone="muted">Why it feels fast</Text>
              <Text size="bodySm" tone="muted">
                Scan locally, review what loads, and move straight into Workbench. The same flow works on desktop and mobile without extra setup.
              </Text>
              <Text size="bodySm" tone="muted">
                Save time by starting from a clean scan and exporting agents.md with consistent structure.
              </Text>
            </Surface>
          </Surface>

          <Surface
            as="section"
            id="library-preview"
            tone="raised"
            padding="lg"
            className="space-y-mdt-6 border-mdt-border-strong shadow-mdt-sm"
          >
            <HomeSectionHeader
              eyebrow="Library preview"
              title="Reuse a public artifact"
              description="Need inspiration? Start from a public artifact and open it in Workbench."
            />
            <div className="grid gap-mdt-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewItems.map((item) => (
                <LibraryCard key={item.id} item={item} variant="preview" />
              ))}
              {previewItems.length === 0 && (
                <Card className="p-mdt-4 text-sm text-mdt-muted">
                  No public items yet. Run a scan to create one.
                </Card>
              )}
            </div>
            <Row justify="start">
              <HomeTrackedButton
                label="Browse Library"
                href="/library"
                ctaId="library"
                placement="library-preview"
                slot="single"
                variant="secondary"
              />
            </Row>
          </Surface>

          <div className="mx-auto max-w-4xl space-y-mdt-4 rounded-mdt-lg border border-mdt-border-strong bg-mdt-surface-raised p-mdt-10 text-center shadow-mdt-lg sm:p-mdt-12">
            <Heading level="h1" as="h2" align="center">Start with a scan</Heading>
            <Text tone="muted" align="center">
              Scan a repo to see what loads, then open Workbench to refine and export agents.md. Use the Library when you want inspiration.
            </Text>
            <Row justify="center" gap={3} className="mt-mdt-6">
              <HomeTrackedButton
                label="Scan a folder"
                href="/atlas/simulator"
                ctaId="scan"
                placement="final-cta"
                slot="primary"
                size="lg"
              />
              <HomeTrackedButton
                label="Open Workbench"
                href="/workbench"
                ctaId="workbench"
                placement="final-cta"
                slot="secondary"
                size="lg"
                variant="secondary"
              />
            </Row>
          </div>
        </Stack>
      </Container>
    </div>
  );
}
