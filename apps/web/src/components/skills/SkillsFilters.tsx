import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import type { ListPublicSkillsInput } from "@/lib/skills/skillTypes";
import type { PublicTag } from "@/lib/publicTags";

type Filters = {
  q: string;
  tags: string[];
  targets: string[];
  sort: NonNullable<ListPublicSkillsInput["sort"]>;
};

export type SkillsFiltersProps = Filters & {
  topTags: PublicTag[];
  availableTargets: string[];
};

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

function toggle(values: string[], value: string) {
  const set = new Set(values);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

function buildHref(next: Filters): string {
  const sp = new URLSearchParams();
  if (next.q.trim().length > 0) sp.set("q", next.q.trim());
  if (next.sort !== "recent") sp.set("sort", next.sort);
  next.tags.forEach((t) => sp.append("tag", t));
  next.targets.forEach((t) => sp.append("target", t));
  const qs = sp.toString();
  return qs.length > 0 ? `/skills?${qs}` : "/skills";
}

function sortLabel(sort: Filters["sort"]) {
  if (sort === "views") return "Most viewed";
  if (sort === "copies") return "Most copied";
  return "Recent";
}

export function SkillsFilters({ q, tags, targets, sort, topTags, availableTargets }: SkillsFiltersProps) {
  const selected: Filters = { q, tags, targets, sort };
  const advancedOpen = tags.length > 0 || targets.length > 0;
  const visibleTags = Array.from(
    new Set([...tags, ...topTags.map(({ tag }) => tag)])
  ).slice(0, 16);

  return (
    <Card className="space-y-mdt-5" padding="lg" tone="raised">
      <div className="flex items-start justify-between gap-mdt-3">
        <div className="space-y-1">
          <Heading level="h3" as="h2">
            Filters
          </Heading>
          <Text size="caption" tone="muted">
            Filter by target, tags, or popularity.
          </Text>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/skills">Clear</Link>
        </Button>
      </div>

      <form action="/skills" method="get" className="space-y-mdt-3">
        <div className="space-y-mdt-2">
          <Text as="label" htmlFor="skills-q" size="caption" tone="muted">
            Search skills
          </Text>
          <Input id="skills-q" name="q" defaultValue={q} placeholder="Search skills or capabilities…" />
        </div>

        {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
        {tags.map((t) => (
          <input key={`tag:${t}`} type="hidden" name="tag" value={t} />
        ))}
        {targets.map((t) => (
          <input key={`target:${t}`} type="hidden" name="target" value={t} />
        ))}

        <Button type="submit" size="md" className="w-full">
          Apply filters
        </Button>
      </form>

      <Stack gap={4}>
        <div className="space-y-mdt-2">
          <Text size="caption" tone="muted">
            Sort
          </Text>
          <Row wrap gap={2}>
            {(["recent", "views", "copies"] as const).map((value) => {
              const active = sort === value;
              return (
                <Link key={value} href={buildHref({ ...selected, sort: value })}>
                  <Pill tone={active ? "blue" : "gray"} className={active ? "" : "hover:bg-mdt-surface-strong"}>
                    {sortLabel(value)}
                  </Pill>
                </Link>
              );
            })}
          </Row>
        </div>

        <details
          className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2"
          open={advancedOpen}
        >
          <summary className="cursor-pointer text-body-sm font-semibold text-mdt-text">
            Advanced filters
          </summary>
          <div className="mt-mdt-3 space-y-mdt-4">
            <div className="space-y-mdt-2">
              <Text size="caption" tone="muted">
                Targets
              </Text>
              <Row wrap gap={2}>
                {availableTargets.slice(0, 8).map((t) => {
                  const active = targets.includes(t);
                  return (
                    <Link key={t} href={buildHref({ ...selected, targets: toggle(targets, t) })}>
                      <Pill tone={active ? "blue" : "gray"} className={active ? "" : "hover:bg-mdt-surface-strong"}>
                        {targetLabel(t)}
                      </Pill>
                    </Link>
                  );
                })}
                {availableTargets.length === 0 && (
                  <Text size="caption" tone="muted">
                    No target metadata yet.
                  </Text>
                )}
              </Row>
            </div>

            <div className="space-y-mdt-2">
              <Text size="caption" tone="muted">
                Tags
              </Text>
              <Row wrap gap={2}>
                {visibleTags.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <Link key={tag} href={buildHref({ ...selected, tags: toggle(tags, tag) })}>
                      <Pill tone={active ? "blue" : "gray"} className={active ? "" : "hover:bg-mdt-surface-strong"}>
                        #{tag}
                      </Pill>
                    </Link>
                  );
                })}
                {visibleTags.length === 0 && (
                  <Text size="caption" tone="muted">
                    No tags yet.
                  </Text>
                )}
              </Row>
            </div>
          </div>
        </details>
      </Stack>
    </Card>
  );
}
