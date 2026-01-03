import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { ChangelogFeed } from "@/components/atlas/ChangelogFeed";
import { loadAtlasChangelog } from "@/lib/atlas/load";

export const dynamic = "force-dynamic";

export default function AtlasChangelogPage() {
  const changelog = loadAtlasChangelog();

  return (
    <main className="py-mdt-4">
      <Stack gap={6}>
        <Stack gap={3}>
          <Heading level="h1">Changelog</Heading>
          <Text tone="muted">Updates to facts, examples, and guides.</Text>
        </Stack>

        {changelog.entries.length === 0 ? <Text tone="muted">No entries yet.</Text> : <ChangelogFeed entries={changelog.entries} />}
      </Stack>
    </main>
  );
}
