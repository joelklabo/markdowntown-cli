import Link from "next/link";
import type { HTMLAttributes } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import type { PublicSkillSummary } from "@/lib/skills/skillTypes";
import { trackSkillOpenWorkbench } from "@/lib/analytics";

const TARGET_LABELS: Record<string, string> = {
  "agents-md": "Codex CLI",
  "github-copilot": "GitHub Copilot",
  "claude-code": "Claude Code",
  "gemini-cli": "Gemini CLI",
  "cursor-rules": "Cursor",
  "windsurf-rules": "Windsurf",
};

function targetLabel(targetId: string) {
  return TARGET_LABELS[targetId] ?? targetId;
}

export function SkillCard({ skill, className, ...rest }: { skill: PublicSkillSummary } & HTMLAttributes<HTMLDivElement>) {
  const slug = skill.slug ?? skill.id;
  const detailHref = `/skills/${slug}`;
  const visibleTargets = skill.targets.slice(0, 4);
  const overflowTargets = skill.targets.length - visibleTargets.length;
  const visibleTags = skill.tags.slice(0, 5);
  const overflowTags = skill.tags.length - visibleTags.length;
  const visibleCapabilities = skill.capabilities.slice(0, 2);
  const overflowCapabilities = skill.capabilityCount - visibleCapabilities.length;

  return (
    <Card
      data-testid="skill-card"
      tone="raised"
      padding="md"
      className={cn("flex h-full flex-col gap-mdt-5", className)}
      {...rest}
    >
      <Stack gap={4}>
        <Row gap={2} align="center" wrap>
          <Pill tone="blue">Skill</Pill>
          <Pill tone="gray">{skill.capabilityCount} {skill.capabilityCount === 1 ? "capability" : "capabilities"}</Pill>
        </Row>

        <Stack gap={2}>
          <Heading level="h3" className="line-clamp-2 leading-tight">
            <Link href={detailHref} className="hover:underline">
              {skill.title}
            </Link>
          </Heading>
          <Text size="bodySm" tone="muted" className="line-clamp-3">
            {skill.description}
          </Text>
        </Stack>

        <Stack gap={2}>
          <Text size="caption" tone="muted">
            Targets
          </Text>
          <Row gap={2} wrap>
            {visibleTargets.map((targetId) => (
              <Pill key={targetId} tone="gray">
                {targetLabel(targetId)}
              </Pill>
            ))}
            {overflowTargets > 0 && <Pill tone="gray">+{overflowTargets}</Pill>}
          </Row>
        </Stack>

        <Stack gap={2}>
          <Text size="caption" tone="muted">
            Capabilities
          </Text>
          <Stack gap={1}>
            {visibleCapabilities.map((capability) => (
              <Text key={capability.id} size="bodySm" className="font-medium text-mdt-text">
                {capability.title ?? capability.id}
              </Text>
            ))}
            {overflowCapabilities > 0 && (
              <Text size="caption" tone="muted">
                +{overflowCapabilities} more
              </Text>
            )}
          </Stack>
        </Stack>

        <Row gap={2} wrap>
          {visibleTags.map((tag) => (
            <Pill key={tag} tone="gray">
              #{tag}
            </Pill>
          ))}
          {overflowTags > 0 && <Pill tone="gray">+{overflowTags}</Pill>}
        </Row>
      </Stack>

      <div className="mt-auto flex flex-wrap gap-mdt-2">
        <Button size="sm" asChild>
          <Link
            href={`/workbench?id=${skill.id}`}
            onClick={() =>
              trackSkillOpenWorkbench({
                id: skill.id,
                slug,
                title: skill.title,
                source: "skills_list",
              })
            }
          >
            Open in Workbench
          </Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link href={detailHref}>View skill</Link>
        </Button>
      </div>
    </Card>
  );
}
