import Link from "next/link";
import { Button } from "./ui/Button";
import { Pill } from "./ui/Pill";
import { Card } from "./ui/Card";
import { Heading } from "./ui/Heading";
import { Row, Stack } from "./ui/Stack";
import { Text } from "./ui/Text";
import { cn } from "@/lib/cn";
import type { SampleItem } from "@/lib/sampleContent";
import { ForkButton } from "@/components/artifact/ForkButton";

// Compatible with SampleItem for now, but prefer PublicItem
type Item = SampleItem;

function badgeLabel(badge?: Item["badge"]) {
  switch (badge) {
    case "new":
      return { label: "New", tone: "green" as const };
    case "trending":
      return { label: "Trending", tone: "yellow" as const };
    case "staff":
      return { label: "Staff pick", tone: "red" as const };
    default:
      return null;
  }
}

type Handlers = {
  onCopySnippet?: (item: Item) => void;
  onUseTemplate?: (item: Item) => void;
  onAddToBuilder?: (item: Item) => void;
  onDownloadFile?: (item: Item) => void;
  onPreview?: (item: Item) => void;
  copied?: boolean;
};

export function LibraryCard({
  item,
  copied,
  onCopySnippet,
  onUseTemplate,
  onAddToBuilder,
  onDownloadFile,
  onPreview,
  draggable,
  onDragStart,
  onDragEnd,
  variant = "default",
  className,
  ...rest
}: { item: Item; variant?: "default" | "preview" } & Handlers & React.HTMLAttributes<HTMLDivElement>) {
  const badge = badgeLabel(item.badge);
  const isPreview = variant === "preview";
  const typeLabel =
    item.type === "snippet"
      ? "Snippet"
      : item.type === "template"
        ? "Template"
        : item.type === "agent"
          ? "Agent"
          : item.type === "skill"
            ? "Skill"
            : "File";
  const slug = item.slug ?? item.id;
  const workbenchHref = item.slug ? `/workbench?slug=${item.slug}` : `/workbench?id=${item.id}`;
  const visibleTags = item.tags.slice(0, isPreview ? 2 : 3);
  const overflowCount = item.tags.length - visibleTags.length;
  const actionSize = "sm" as const;
  const detailHref =
    item.type === "template"
      ? `/templates/${slug}`
      : item.type === "file"
        ? `/files/${slug}`
        : item.type === "agent" || item.type === "skill"
          ? `/a/${slug}`
          : `/snippets/${slug}`;

  const primaryAction =
    item.type === "file"
      ? { label: "Download", href: detailHref }
      : { label: "Open in Workbench", href: workbenchHref };

  const renderPrimary = () => {
    if (item.type === "file" && onDownloadFile) {
      return (
        <Button
          size={actionSize}
          variant="primary"
          onClick={() => onDownloadFile(item)}
          aria-label={`Download ${item.title}`}
        >
          {primaryAction.label}
        </Button>
      );
    }
    if (item.type !== "file" && onAddToBuilder) {
      return (
        <Button
          size={actionSize}
          variant="primary"
          onClick={() => onAddToBuilder(item)}
          aria-label={`Open ${item.title} in Workbench`}
        >
          {primaryAction.label}
        </Button>
      );
    }
    return (
      <Button size={actionSize} variant="primary" asChild>
        <Link href={primaryAction.href}>{primaryAction.label}</Link>
      </Button>
    );
  };


  const renderOverflow = () => {
    const items: React.ReactNode[] = [];
    const detailLabel =
      item.type === "template"
        ? "Open template"
        : item.type === "snippet"
          ? "Open snippet"
          : item.type === "agent"
            ? "Open agent"
            : item.type === "skill"
              ? "Open skill"
              : "Open detail";

    if (onPreview) {
      items.push(
        <Button key="preview" variant="ghost" size={actionSize} onClick={() => onPreview(item)} className="w-full justify-start">
          Preview
        </Button>
      );
    }
    if (onCopySnippet) {
      items.push(
        <Button
          key="copy"
          variant="ghost"
          size={actionSize}
          onClick={() => onCopySnippet(item)}
          className="w-full justify-start"
        >
          {copied ? "Copied" : "Copy snippet"}
        </Button>
      );
    }
    if (onUseTemplate) {
      items.push(
        <Button
          key="template"
          variant="ghost"
          size={actionSize}
          onClick={() => onUseTemplate(item)}
          className="w-full justify-start"
        >
          Open template
        </Button>
      );
    }
    if (item.type === "file" && onDownloadFile) {
      items.push(
        <Button
          key="download"
          variant="ghost"
          size={actionSize}
          onClick={() => onDownloadFile(item)}
          className="w-full justify-start"
        >
          Download file
        </Button>
      );
    }
    if (item.type !== "file") {
      items.push(
        <ForkButton key="fork" artifactId={item.id} size={actionSize} variant="ghost" label="Fork" className="w-full justify-start" />
      );
    }
    if (detailHref && item.type !== "file") {
      items.push(
        <Button key="detail" variant="ghost" size={actionSize} asChild className="w-full justify-start">
          <Link href={detailHref}>{detailLabel}</Link>
        </Button>
      );
    }

    if (items.length === 0) return null;

    return (
      <details className="relative">
        <Button variant="secondary" size={actionSize} asChild>
          <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">More</summary>
        </Button>
        <div className="absolute right-0 z-10 mt-mdt-2 w-48 rounded-mdt-md border border-mdt-border bg-mdt-surface-raised p-mdt-2 shadow-mdt-lg">
          <Stack gap={1}>
            {items}
          </Stack>
        </div>
      </details>
    );
  };

  return (
    <Card
      data-testid="library-card"
      tone="raised"
      padding="md"
      className={cn(
        "group flex h-full flex-col gap-mdt-5 motion-reduce:transition-none",
        className
      )}
      {...rest}
    >
      <Stack gap={4}>
        <Row gap={2} align="center" justify="between" wrap>
          <Row gap={2} align="center" wrap>
            <Pill tone="blue">{typeLabel}</Pill>
            {badge && <Pill tone={badge.tone}>{badge.label}</Pill>}
          </Row>
          {draggable && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              draggable
              onDragStart={onDragStart as React.DragEventHandler<HTMLButtonElement> | undefined}
              onDragEnd={onDragEnd as React.DragEventHandler<HTMLButtonElement> | undefined}
              className="cursor-grab select-none text-mdt-muted hover:text-mdt-text active:cursor-grabbing"
              aria-label="Drag card to Workbench"
              onClick={(e) => e.stopPropagation()}
            >
              Drag
            </Button>
          )}
        </Row>

        <Stack gap={2}>
          <Heading level="h3" className="line-clamp-2 leading-tight">
            {item.title}
          </Heading>
          <Text size="bodySm" tone="muted" className="line-clamp-3">
            {item.description}
          </Text>
        </Stack>

        <Row gap={2} wrap>
          {visibleTags.map((tag) => (
            <Pill key={tag} tone="gray">
              #{tag}
            </Pill>
          ))}
          {overflowCount > 0 && (
            <Pill tone="gray">+{overflowCount}</Pill>
          )}
        </Row>
      </Stack>

      <div className="mt-auto space-y-mdt-4 border-t border-mdt-border pt-mdt-4">
        <Row gap={3} wrap className="text-caption text-mdt-muted">
          <Text as="span" size="caption" tone="muted">
            {item.stats.views.toLocaleString()} views
          </Text>
          <Text as="span" size="caption" tone="muted">
            {item.stats.copies.toLocaleString()} copies
          </Text>
          <Text as="span" size="caption" tone="muted">
            {item.stats.votes.toLocaleString()} votes
          </Text>
        </Row>
        {!isPreview && (
          <Row gap={2} align="center" wrap className="relative z-10 w-full justify-start sm:justify-end">
            {renderPrimary()}
            {renderOverflow()}
          </Row>
        )}
      </div>
    </Card>
  );
}
