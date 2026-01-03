import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Changelog | mark downtown",
  description: "Release notes and history for mark downtown.",
};

async function loadChangelogExcerpt() {
  try {
    const file = await fs.readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
    // Show the top of the changelog so users see the latest release right away.
    return file.split("\n").slice(0, 60).join("\n").trim();
  } catch (err) {
    console.warn("changelog: unable to read file", err);
    return null;
  }
}

export default async function ChangelogPage() {
  const excerpt = await loadChangelogExcerpt();

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={10}>
          <Stack gap={4} className="max-w-2xl">
            <Text size="caption" tone="muted">Changelog</Text>
            <Heading level="display" leading="tight">What\u2019s new in mark downtown</Heading>
            <Text tone="muted" leading="relaxed">
              Recent releases, fixes, and improvements. View the complete history on GitHub.
            </Text>
            <div className="flex flex-wrap items-center gap-mdt-3">
              <Button variant="secondary" size="sm" asChild className="motion-reduce:transition-none">
                <Link
                  href="https://github.com/joelklabo/markdowntown/blob/main/CHANGELOG.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open full changelog
                </Link>
              </Button>
              <Text size="caption" tone="muted">Pulls the latest 60 lines from CHANGELOG.md.</Text>
            </div>
          </Stack>

          <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.5fr)]">
            <Surface padding="lg" className="space-y-mdt-5">
              <div className="flex items-center justify-between">
                <Heading level="h3" as="h2">Latest entries</Heading>
                <Text size="caption" tone="muted">Newest release notes</Text>
              </div>
              {excerpt ? (
                <pre className="whitespace-pre-wrap font-mono text-body-sm text-mdt-text leading-relaxed">{excerpt}</pre>
              ) : (
                <Text size="bodySm" tone="muted">
                  Couldn\u2019t load the changelog from the repository. Check the GitHub link above for the latest notes.
                </Text>
              )}
            </Surface>

            <Surface tone="subtle" padding="lg" className="space-y-mdt-5">
              <Text size="caption" tone="muted">Release notes</Text>
              <Heading level="h3" as="h3">Quick scan tips</Heading>
              <Text tone="muted" leading="relaxed">
                Skim the first headings for major updates, then dig into bullet lists for fixes and smaller changes.
              </Text>
              <ul className="space-y-mdt-3 list-disc pl-mdt-5">
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Use search to find terms like \u201cAtlas\u201d, \u201cWorkbench\u201d, or \u201cBuild\u201d.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Check for migration notes before upgrading local environments.
                </Text>
                <Text as="li" size="bodySm" tone="muted" leading="relaxed">
                  Review the full GitHub changelog for historical context.
                </Text>
              </ul>
            </Surface>
          </div>
        </Stack>
      </Container>
    </main>
  );
}
