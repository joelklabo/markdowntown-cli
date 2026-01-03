import { listPublicSkills } from "@/lib/publicSkills";
import { listTopTags } from "@/lib/publicTags";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { SkillsFilters } from "@/components/skills/SkillsFilters";
import { SkillsList } from "@/components/skills/SkillsList";
import { SkillsEmptyState } from "@/components/skills/SkillsEmptyState";
import { SkillsListTracker } from "@/components/skills/SkillsListTracker";
import type { ListPublicSkillsInput } from "@/lib/skills/skillTypes";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asArray(input?: string | string[]): string[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function parseSort(input?: string): NonNullable<ListPublicSkillsInput["sort"]> {
  if (input === "views" || input === "copies") return input;
  return "recent";
}

export default async function SkillsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const sort = parseSort(typeof searchParams.sort === "string" ? searchParams.sort : undefined);

  const tags = [
    ...asArray(searchParams.tag),
    ...(typeof searchParams.tags === "string"
      ? searchParams.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []),
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const targets = [
    ...asArray(searchParams.target),
    ...(typeof searchParams.targets === "string"
      ? searchParams.targets
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []),
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const [skills, topTags] = await Promise.all([
    listPublicSkills({
      limit: 60,
      sort,
      tags,
      targets,
      search: q.length > 0 ? q : null,
    }),
    listTopTags(24, 30),
  ]);

  const availableTargets = Array.from(new Set(skills.flatMap((skill) => skill.targets))).sort((a, b) => a.localeCompare(b));
  const hasFilters = q.length > 0 || tags.length > 0 || targets.length > 0;

  return (
    <Container className="py-mdt-10 md:py-mdt-12">
      <Stack gap={8}>
        <SkillsListTracker count={skills.length} q={q} tags={tags} targets={targets} sort={sort} />
        <Stack gap={2}>
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            Skills library
          </Text>
          <Heading level="h1">Skills</Heading>
          <Text tone="muted" className="max-w-2xl">
            Discover reusable skills for Codex CLI, Copilot CLI, and Claude Code. Filter by target, tag, or popularity to find what fits your team.
          </Text>
        </Stack>

        <div className="grid gap-mdt-8 lg:grid-cols-[320px_1fr]">
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <SkillsFilters
              q={q}
              tags={tags}
              targets={targets}
              sort={sort}
              topTags={topTags}
              availableTargets={availableTargets.length > 0 ? availableTargets : ["agents-md", "github-copilot", "claude-code"]}
            />
          </div>

          <div className="min-w-0 space-y-mdt-5">
            <div className="flex flex-col gap-mdt-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Text size="caption" tone="muted">Results</Text>
                <Heading level="h3" as="h2">
                  {q.length > 0 ? `Results for “${q}”` : "All skills"}
                </Heading>
              </div>
              <Text size="caption" tone="muted">
                {skills.length} result{skills.length === 1 ? "" : "s"}
              </Text>
            </div>

            {skills.length > 0 ? (
              <SkillsList skills={skills} />
            ) : (
              <SkillsEmptyState hasFilters={hasFilters} />
            )}
          </div>
        </div>
      </Stack>
    </Container>
  );
}
