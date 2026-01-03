import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import type { PublicSkillDetail } from "@/lib/skills/skillTypes";
import { SkillMetadata } from "@/components/skills/SkillMetadata";
import { SkillParams } from "@/components/skills/SkillParams";
import { trackSkillOpenWorkbench } from "@/lib/analytics";

export function SkillDetail({ skill }: { skill: PublicSkillDetail }) {
  const capabilities = skill.content.capabilities ?? [];

  return (
    <Stack gap={10}>
      <Surface tone="raised" padding="lg" className="space-y-mdt-6">
        <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <SkillMetadata skill={skill} />
          <div className="flex w-full flex-col gap-mdt-3 lg:w-auto">
            <Button size="md" asChild>
              <Link
                href={`/workbench?id=${skill.id}`}
                onClick={() =>
                  trackSkillOpenWorkbench({
                    id: skill.id,
                    slug: skill.slug ?? skill.id,
                    title: skill.title,
                    source: "skills_detail",
                  })
                }
              >
                Open in Workbench
              </Link>
            </Button>
            <Button size="md" variant="secondary" asChild>
              <Link href="/skills">Back to Skills</Link>
            </Button>
          </div>
        </div>
      </Surface>

      <Stack gap={4}>
        <Heading level="h2" as="h2">
          Capabilities
        </Heading>

        {capabilities.length === 0 ? (
          <Card tone="raised" padding="lg" className="space-y-mdt-2">
            <Heading level="h3" as="h3">
              No capabilities defined yet
            </Heading>
            <Text tone="muted">
              Add capabilities in Workbench to make this skill actionable.
            </Text>
            <Button size="sm" asChild>
              <Link
                href={`/workbench?id=${skill.id}`}
                onClick={() =>
                  trackSkillOpenWorkbench({
                    id: skill.id,
                    slug: skill.slug ?? skill.id,
                    title: skill.title,
                    source: "skills_detail_empty_state",
                  })
                }
              >
                Add capabilities
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-mdt-4">
            {capabilities.map((capability) => (
              <Card key={capability.id} tone="raised" padding="lg" className="space-y-mdt-3">
                <Stack gap={2}>
                  <Heading level="h3" as="h3">
                    {capability.title ?? capability.id}
                  </Heading>
                  <Text size="caption" tone="muted" className="font-mono">
                    {capability.id}
                  </Text>
                </Stack>

                {capability.description && capability.description.trim().length > 0 && (
                  <Text tone="muted" leading="relaxed">
                    {capability.description}
                  </Text>
                )}

                <SkillParams params={capability.params} />
              </Card>
            ))}
          </div>
        )}
      </Stack>
    </Stack>
  );
}
