import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import type { PublicSkillDetail } from "@/lib/skills/skillTypes";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

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

export function SkillMetadata({ skill }: { skill: PublicSkillDetail }) {
  return (
    <Stack gap={4} className="min-w-0">
      <Row gap={2} align="center" wrap>
        <Pill tone="blue">Skill</Pill>
        <Text size="caption" tone="muted">
          v{skill.version}
        </Text>
        <Text size="caption" tone="muted">
          Updated {formatDate(skill.updatedAt)}
        </Text>
      </Row>

      <Heading level="display" leading="tight">
        {skill.title}
      </Heading>

      {skill.description.trim().length > 0 && (
        <Text tone="muted" leading="relaxed" className="max-w-3xl">
          {skill.description}
        </Text>
      )}

      <Row gap={2} className="flex-wrap">
        <Pill tone="green">{skill.capabilityCount} capabilities</Pill>
      </Row>

      {skill.targets.length > 0 && (
        <Stack gap={2}>
          <Text size="caption" tone="muted">
            Supported targets
          </Text>
          <Row gap={2} className="flex-wrap">
            {skill.targets.map((target) => (
              <Pill key={target} tone="gray">
                {targetLabel(target)}
              </Pill>
            ))}
          </Row>
        </Stack>
      )}

      {skill.tags.length > 0 && (
        <Row gap={2} className="flex-wrap">
          {skill.tags.map((tag) => (
            <Pill key={tag} tone="gray">
              #{tag}
            </Pill>
          ))}
        </Row>
      )}
    </Stack>
  );
}
