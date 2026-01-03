import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Docs | mark downtown",
  description: "Documentation and guides for mark downtown, instruction files, Atlas Simulator, and Workbench.",
};

const repoBase = "https://github.com/joelklabo/markdowntown/blob/main";
const getStartedLink = {
  label: "Scan → Workbench → Export guide",
  description: "Scan a folder, review loaded instructions, and export agents.md.",
  href: `${repoBase}/docs/USER_GUIDE.md`,
};

const referenceLinks = [
  {
    label: "AGENTS.md",
    description: "Project-specific agent instructions and workflow defaults.",
    href: `${repoBase}/AGENTS.md`,
  },
  {
    label: "README",
    description: "Product overview, setup notes, and local development hints.",
    href: `${repoBase}/README.md`,
  },
  {
    label: "Atlas Simulator guide",
    description: "Preview which instruction files load and why.",
    href: `${repoBase}/docs/atlas/simulator.md`,
  },
  {
    label: "Developer onboarding",
    description: "Start here for environment, scripts, and architecture notes.",
    href: `${repoBase}/docs/DEV_ONBOARDING.md`,
  },
  {
    label: "Beads CLI",
    description: "Issue workflow conventions and task structure.",
    href: `${repoBase}/docs/BEADS.md`,
  },
];

export default function DocsPage() {
  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={10}>
          <Stack gap={4} className="max-w-2xl">
            <Text size="caption" tone="muted">Docs</Text>
            <Heading level="display" leading="tight">mark downtown documentation</Heading>
            <Text tone="muted" leading="relaxed">
              Start here with the user guide, then dive into Atlas Simulator and Workbench when you’re ready to ship
              agents.md.
            </Text>
          </Stack>

          <div className="grid gap-mdt-6 lg:grid-cols-2">
            <Card id="get-started" tone="subtle" padding="lg" className="space-y-mdt-5">
              <Text size="caption" tone="muted">Get started</Text>
              <Heading level="h3" as="h3">Launch the Scan → Workbench → Export flow</Heading>
              <Text tone="muted" leading="relaxed">
                Follow the user guide to run your first scan, review what loads, and export a clean agents.md.
              </Text>
              <ul className="space-y-mdt-3 list-disc pl-mdt-5">
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Scan your repo in Atlas Simulator and confirm the loaded files.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Resolve missing instruction files with the provided templates.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Open Workbench to compile and export your instruction bundle.
                </Text>
              </ul>
              <Button asChild className="self-start">
                <Link href={getStartedLink.href}>{getStartedLink.label}</Link>
              </Button>
            </Card>

            <Card tone="subtle" padding="lg" className="space-y-mdt-5">
              <Text size="caption" tone="muted">Reference</Text>
              <Heading level="h3" as="h3">Deep dive on formats and tooling</Heading>
              <Text tone="muted" leading="relaxed">
                Use the reference library for instruction formats, Atlas Simulator specifics, and developer setup.
              </Text>
              <Button variant="secondary" asChild className="self-start">
                <Link href="#reference">Browse reference links</Link>
              </Button>
              <Text size="bodySm" tone="muted">
                {referenceLinks.length} reference resources available.
              </Text>
            </Card>
          </div>

          <Stack gap={4} id="reference">
            <div className="flex flex-col gap-mdt-2 sm:flex-row sm:items-center sm:justify-between">
              <Heading level="h3" as="h2">Reference library</Heading>
              <Text size="caption" tone="muted">{referenceLinks.length} resources</Text>
            </div>
            <div className="grid gap-mdt-4">
              {referenceLinks.map((link) => (
                <Card
                  key={link.href}
                  padding="lg"
                  className="flex flex-col gap-mdt-4 md:flex-row md:items-center md:justify-between focus-within:border-mdt-border-strong focus-within:shadow-mdt-md motion-reduce:transition-none"
                >
                  <div className="space-y-mdt-1">
                    <Heading level="h3" as="h3">{link.label}</Heading>
                    <Text size="bodySm" tone="muted" leading="relaxed">{link.description}</Text>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className="group self-start md:self-auto motion-reduce:transition-none"
                  >
                    <Link href={link.href}>
                      <span>Open</span>
                      <span
                        aria-hidden="true"
                        className="transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-focus:translate-x-0.5 motion-reduce:transform-none"
                      >
                        →
                      </span>
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          </Stack>
        </Stack>
      </Container>
    </main>
  );
}
