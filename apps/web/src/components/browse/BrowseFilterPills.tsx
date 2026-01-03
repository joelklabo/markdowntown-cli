"use client";

import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { track } from "@/lib/analytics";

type Option = { label: string; key: string; href: string; active: boolean };
type TagOption = { label: string; href: string; active: boolean };
type ActiveTag = { label: string; removeHref: string };

type Props = {
  sortOptions: Option[];
  typeOptions: Option[];
  popularTags: TagOption[];
  activeTags: ActiveTag[];
  clearTagsHref: string;
};

export function BrowseFilterPills({ sortOptions, typeOptions, popularTags, activeTags, clearTagsHref }: Props) {
  return (
    <div className="space-y-mdt-5">
      <div className="space-y-mdt-2">
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          Sort
        </Text>
        <div className="flex flex-wrap gap-mdt-2">
          {sortOptions.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              onClick={() => track("browse_filter_select", { type: "sort", value: option.key })}
              className="inline-flex rounded-mdt-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]"
            >
              <Pill
                tone={option.active ? "blue" : "gray"}
                className="cursor-pointer transition duration-mdt-fast ease-mdt-standard hover:bg-mdt-surface-strong motion-reduce:transition-none"
              >
                {option.label}
              </Pill>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-mdt-2">
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          Types
        </Text>
        <div className="flex flex-wrap gap-mdt-2">
          {typeOptions.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              onClick={() => track("browse_filter_select", { type: "content_type", value: option.key })}
              className="inline-flex rounded-mdt-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]"
            >
              <Pill
                tone={option.active ? "blue" : "gray"}
                className="cursor-pointer transition duration-mdt-fast ease-mdt-standard hover:bg-mdt-surface-strong motion-reduce:transition-none"
              >
                {option.label}
              </Pill>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-mdt-2">
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          Popular tags
        </Text>
        <div className="flex flex-wrap gap-mdt-2">
          {popularTags.map((tag) => (
            <Link
              key={tag.label}
              href={tag.href}
              onClick={() => track("browse_filter_select", { type: "tag", value: tag.label })}
              className="inline-flex rounded-mdt-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]"
            >
              <Pill
                tone={tag.active ? "blue" : "gray"}
                className="cursor-pointer transition duration-mdt-fast ease-mdt-standard hover:bg-mdt-surface-strong motion-reduce:transition-none"
              >
                #{tag.label}
              </Pill>
            </Link>
          ))}
        </div>
      </div>

      {activeTags.length > 0 && (
        <div className="space-y-mdt-2" aria-label="Active tag filters">
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            Active filters
          </Text>
          <div className="flex flex-wrap items-center gap-mdt-2">
            {activeTags.map((tag) => (
              <Pill key={tag.label} tone="blue" className="gap-mdt-1">
                <span>#{tag.label}</span>
                <Link
                  href={tag.removeHref}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-mdt-surface-strong text-[11px] text-mdt-text"
                  aria-label={`Remove tag ${tag.label}`}
                  onClick={() => track("browse_filter_remove", { type: "tag", value: tag.label })}
                >
                  ×
                </Link>
              </Pill>
            ))}
            <Button variant="ghost" size="xs" asChild>
              <Link href={clearTagsHref} onClick={() => track("browse_filter_clear_tags")}>
                Clear filters
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
