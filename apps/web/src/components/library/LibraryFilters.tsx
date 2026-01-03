import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Stack, Row } from "@/components/ui/Stack";
import type { PublicItemType } from "@/lib/publicItems";
import type { PublicTag } from "@/lib/publicTags";

type Filters = {
  q: string;
  type: PublicItemType | "all";
  tags: string[];
  targets: string[];
  hasScopes?: boolean;
};

export type LibraryFiltersProps = Filters & {
  topTags: PublicTag[];
  availableTargets: string[];
};

function toggle(values: string[], value: string) {
  const set = new Set(values);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

function buildHref(next: Filters): string {
  const sp = new URLSearchParams();
  if (next.q.trim().length > 0) sp.set("q", next.q.trim());
  if (next.type !== "all") sp.set("type", next.type);
  next.tags.forEach((t) => sp.append("tag", t));
  next.targets.forEach((t) => sp.append("target", t));
  if (next.hasScopes === true) sp.set("hasScopes", "1");
  const qs = sp.toString();
  return qs.length > 0 ? `/library?${qs}` : "/library";
}

export function LibraryFilters({ q, type, tags, targets, hasScopes, topTags, availableTargets }: LibraryFiltersProps) {
  const selected: Filters = { q, type, tags, targets, hasScopes };
  const advancedOpen = tags.length > 0 || hasScopes === true;

  return (
    <Card className="space-y-mdt-5" padding="lg" tone="raised">
      <div className="flex items-start justify-between gap-mdt-3">
        <div className="space-y-1">
          <Heading level="h3" as="h2">
            Filters
          </Heading>
          <Text size="caption" tone="muted">
            Refine by type, targets, tags, or scopes.
          </Text>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/library">Clear</Link>
        </Button>
      </div>

      <form action="/library" method="get" className="space-y-mdt-3">
        <div className="space-y-mdt-2">
          <Text as="label" htmlFor="library-q" size="caption" tone="muted">
            Search library
          </Text>
          <Input id="library-q" name="q" defaultValue={q} placeholder="Search titles, descriptions, or tags…" />
        </div>

        {type !== "all" && <input type="hidden" name="type" value={type} />}
        {hasScopes === true && <input type="hidden" name="hasScopes" value="1" />}
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
        <div className="space-y-mdt-3">
          <Text size="caption" tone="muted">
            Common filters
          </Text>
          <div className="space-y-mdt-2">
            <Text size="caption" tone="muted">
              Type
            </Text>
            <Row wrap gap={2}>
              {(["all", "agent", "skill", "template", "snippet", "file"] as const).map((t) => {
                const active = type === t;
                const label = t === "all" ? "All" : t === "agent" ? "Artifacts" : t === "skill" ? "Skills" : t[0]!.toUpperCase() + t.slice(1);
                return (
                  <Link key={t} href={buildHref({ ...selected, type: t })}>
                    <Pill tone={active ? "blue" : "gray"} className={active ? "" : "hover:bg-mdt-surface-strong"}>
                      {label}
                    </Pill>
                  </Link>
                );
              })}
            </Row>
          </div>

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
                      {t}
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
                Scopes
              </Text>
              <Row wrap gap={2}>
                <Link href={buildHref({ ...selected, hasScopes: hasScopes === true ? undefined : true })}>
                  <Pill tone={hasScopes === true ? "blue" : "gray"} className={hasScopes === true ? "" : "hover:bg-mdt-surface-strong"}>
                    Supports scopes
                  </Pill>
                </Link>
              </Row>
            </div>

            <div className="space-y-mdt-2">
              <Text size="caption" tone="muted">
                Tags
              </Text>
              <Row wrap gap={2}>
                {topTags.slice(0, 12).map(({ tag }) => {
                  const active = tags.includes(tag);
                  return (
                    <Link key={tag} href={buildHref({ ...selected, tags: toggle(tags, tag) })}>
                      <Pill tone={active ? "blue" : "gray"} className={active ? "" : "hover:bg-mdt-surface-strong"}>
                        #{tag}
                      </Pill>
                    </Link>
                  );
                })}
                {topTags.length === 0 && (
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
