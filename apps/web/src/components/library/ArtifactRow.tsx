"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { ForkButton } from "@/components/artifact/ForkButton";
import { PreviewDrawer } from "@/components/library/PreviewDrawer";
import { trackLibraryAction } from "@/lib/analytics";

export type ArtifactRowItem = {
  id: string;
  slug?: string;
  title: string;
  description: string;
  tags: string[];
  targets: string[];
  hasScopes: boolean;
  stats: { views: number; copies: number; votes: number };
  type: "snippet" | "template" | "file" | "agent" | "skill";
};

function typeLabel(type: ArtifactRowItem["type"]) {
  if (type === "snippet") return "Snippet";
  if (type === "template") return "Template";
  if (type === "file") return "File";
  if (type === "agent") return "Agent";
  if (type === "skill") return "Skill";
  return "Artifact";
}

export function ArtifactRow({ item }: { item: ArtifactRowItem }) {
  const [copied, setCopied] = React.useState(false);
  const slugOrId = item.slug ?? item.id;
  const detailHref = `/a/${slugOrId}`;

  async function handleCopy() {
    try {
      const url = `${window.location.origin}${detailHref}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      trackLibraryAction({
        action: "copy",
        id: item.id,
        slug: item.slug,
        title: item.title,
        source: "library_card",
      });
    } catch (err) {
      console.warn("copy failed", err);
    }
  }

  return (
    <Card
      data-testid="artifact-row"
      className={cn(
        "flex flex-col gap-mdt-4 sm:flex-row sm:items-start sm:justify-between"
      )}
      padding="md"
      tone="raised"
    >
      <div className="min-w-0 flex-1 space-y-mdt-3">
        <div className="flex flex-wrap items-center gap-mdt-2">
          <Pill tone="blue">{typeLabel(item.type)}</Pill>
          {item.hasScopes ? <Pill tone="green">Scopes</Pill> : null}
          {item.targets.slice(0, 3).map((t) => (
            <Pill key={t} tone="gray">
              {t}
            </Pill>
          ))}
        </div>

        <div className="space-y-mdt-1">
          <Link href={detailHref} className="block">
            <div className="text-body font-semibold text-mdt-text line-clamp-2">{item.title}</div>
          </Link>
          <Text size="bodySm" tone="muted" className="line-clamp-2">
            {item.description}
          </Text>
        </div>

        <div className="flex flex-wrap gap-mdt-2">
          {item.tags.slice(0, 6).map((tag) => (
            <Pill key={tag} tone="gray">
              #{tag}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap gap-mdt-3 text-caption text-mdt-muted">
          <Text as="span" size="caption" tone="muted">
            {item.stats.views.toLocaleString()} views
          </Text>
          <Text as="span" size="caption" tone="muted">
            {item.stats.copies.toLocaleString()} copies
          </Text>
          <Text as="span" size="caption" tone="muted">
            {item.stats.votes.toLocaleString()} votes
          </Text>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-mdt-2 sm:flex-col sm:items-end sm:justify-start">
        <Button size="sm" variant="primary" asChild>
          <Link
            href={`/workbench?id=${item.id}`}
            onClick={() =>
              trackLibraryAction({
                action: "open_workbench",
                id: item.id,
                slug: item.slug,
                title: item.title,
                source: "library_card",
              })
            }
          >
            Open in Workbench
          </Link>
        </Button>
        <PreviewDrawer artifactId={item.id} title={item.title} targets={item.targets} />
        <Button size="xs" variant="ghost" onClick={handleCopy} aria-label={`Copy link for ${item.title}`}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <ForkButton
          artifactId={item.id}
          size="xs"
          variant="ghost"
          label="Fork"
          analytics={{ source: "library_card", title: item.title, slug: item.slug }}
        />
      </div>
    </Card>
  );
}
