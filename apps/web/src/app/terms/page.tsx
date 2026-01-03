import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export const metadata: Metadata = {
  title: "Terms | mark downtown",
  description: "Terms of use for the mark downtown demo environment.",
};

export default function TermsPage() {
  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={10}>
          <Stack gap={4} className="max-w-2xl">
            <Text size="caption" tone="muted">Terms</Text>
            <Heading level="display" leading="tight">Terms for the local preview</Heading>
            <Text tone="muted" leading="relaxed">
              These terms apply to the local/demo build of mark downtown. If you self-host, you control storage,
              retention, and access in your environment.
            </Text>
          </Stack>

          <div className="grid gap-mdt-6 lg:grid-cols-2">
            <Surface padding="lg" className="space-y-mdt-5">
              <Heading level="h3" as="h2">Acceptable use</Heading>
              <ul className="list-disc space-y-mdt-3 pl-mdt-5">
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Use the app for composing, copying, or testing markdown content.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Avoid uploading sensitive or production data in this preview environment.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Respect third-party licenses when importing, exporting, or sharing content.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Keep automated scripts or bots respectful of rate limits and shared resources.
                </Text>
              </ul>
            </Surface>

            <Surface padding="lg" className="space-y-mdt-5">
              <Heading level="h3" as="h2">Local-only expectations</Heading>
              <ul className="list-disc space-y-mdt-3 pl-mdt-5">
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Atlas Simulator scans run locally in your browser and only read file paths.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  File contents remain on your machine; simulations do not upload repo data.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Optional analytics capture high-level events only when configured.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  When analytics are enabled, file paths, cwd values, and folder names are redacted before events are sent.
                </Text>
              </ul>
            </Surface>
          </div>

          <Surface tone="subtle" padding="lg" className="space-y-mdt-5">
            <Heading level="h3" as="h2">Liability & availability</Heading>
            <Text size="bodySm" tone="muted" leading="relaxed">
              This preview is provided &quot;as is&quot; with no uptime guarantees. Content may be cleared during
              development cycles, so keep backups of anything important.
            </Text>
            <Text size="bodySm" tone="muted" leading="relaxed">
              Report issues or questions on GitHub{" "}
              <Link
                href="https://github.com/joelklabo/markdowntown/issues"
                className="text-mdt-blue hover:underline"
                target="_blank"
                rel="noreferrer noopener"
              >
                github.com/joelklabo/markdowntown
              </Link>
              .
            </Text>
          </Surface>
        </Stack>
      </Container>
    </main>
  );
}
