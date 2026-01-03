import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export const metadata: Metadata = {
  title: "Privacy | mark downtown",
  description: "Learn how mark downtown handles data in this preview environment.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={10}>
          <Stack gap={4} className="max-w-2xl">
            <Text size="caption" tone="muted">Privacy</Text>
            <Heading level="display" leading="tight">Your data stays in your workspace</Heading>
            <Text tone="muted" leading="relaxed">
              mark downtown runs as a local or self-hosted preview. We only keep what you intentionally save, and Atlas
              folder scans stay in your browser using local file access.
            </Text>
          </Stack>

          <Surface tone="subtle" padding="lg" className="space-y-mdt-5">
            <div className="flex flex-wrap items-center justify-between gap-mdt-2">
              <Heading level="h3" as="h2">Local-first summary</Heading>
              <Text size="caption" tone="muted">Privacy essentials</Text>
            </div>
            <ul className="list-disc space-y-mdt-3 pl-mdt-5">
              <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                Folder scans run locally in your browser; file contents never leave your device.
              </Text>
              <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                Simulator results use file paths only, and repo contents are not stored on our servers.
              </Text>
              <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                Analytics (if enabled) redact file paths, cwd values, and folder names.
              </Text>
              <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                Optional analytics (when enabled) capture event names, tool selections, and counts\u2014not file contents.
              </Text>
            </ul>
          </Surface>

          <div className="grid gap-mdt-6 lg:grid-cols-2">
            <Surface padding="lg" className="space-y-mdt-5">
              <Heading level="h3" as="h2">What we store</Heading>
              <ul className="list-disc space-y-mdt-3 pl-mdt-5">
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  GitHub sign-in profile basics (name, avatar, and email if provided) when you authenticate.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Content you choose to save, such as snippets, templates, or documents.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Session metadata needed to keep you signed in and connect saved items to your account.
                </Text>
              </ul>
            </Surface>

            <Surface padding="lg" className="space-y-mdt-5">
              <Heading level="h3" as="h2">Your controls</Heading>
              <ul className="list-disc space-y-mdt-3 pl-mdt-5">
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Browse and copy content without signing in.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Delete saved documents from the Documents area when signed in.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Disable analytics by leaving optional telemetry env vars unset.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Clear your local database or preview data store to remove everything.
                </Text>
              </ul>
              <Text size="bodySm" tone="muted" leading="relaxed">
                Questions? Reach out via the project GitHub issues{" "}
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
          </div>
        </Stack>
      </Container>
    </main>
  );
}
