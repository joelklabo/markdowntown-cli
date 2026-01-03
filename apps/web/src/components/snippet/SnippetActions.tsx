"use client";

import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";

type Props = {
  id: string;
  slug?: string;
  title: string;
  content: string;
  variant?: "inline" | "bar";
};

export function SnippetActions({ id, slug, title, content, variant = "inline" }: Props) {
  const href = `/snippets/${slug ?? id}`;
  const workbenchHref = slug ? `/workbench?slug=${slug}` : `/workbench?id=${id}`;
  const actionSize = "sm";

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      track("snippet_copy", { id, slug, title });
    } catch (err) {
      console.warn("copy failed", err);
    }
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.origin + href : href;
    const titleText = `${title} | mark downtown`;
    try {
      if (navigator.share) {
        await navigator.share({ title: titleText, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      track("snippet_share", { id, slug, title });
    } catch (err) {
      console.warn("share failed", err);
    }
  }

  function toWorkbench() {
    track("snippet_add_builder", { id, slug, title });
    window.location.href = workbenchHref;
  }

  function download() {
    try {
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug ?? id}.md`;
      a.click();
      URL.revokeObjectURL(url);
      track("snippet_download", { id, slug, title });
    } catch (err) {
      console.warn("download failed", err);
    }
  }

  const renderOverflow = () => (
    <details className="relative">
      <Button variant="secondary" size={actionSize} asChild>
        <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">More</summary>
      </Button>
      <div className="absolute right-0 z-10 mt-mdt-2 w-48 rounded-mdt-md border border-mdt-border bg-mdt-surface-raised p-mdt-2 shadow-mdt-lg">
        <div className="flex flex-col gap-mdt-1">
          <Button variant="ghost" size={actionSize} onClick={copy} className="w-full justify-start">
            Copy
          </Button>
          <Button variant="ghost" size={actionSize} onClick={download} className="w-full justify-start">
            Download
          </Button>
          <Button variant="ghost" size={actionSize} onClick={share} className="w-full justify-start" aria-label={`Share link to ${title}`}>
            Share
          </Button>
          <Button variant="ghost" size={actionSize} asChild className="w-full justify-start">
            <a href={href}>Open detail</a>
          </Button>
        </div>
      </div>
    </details>
  );

  if (variant === "bar") {
    return (
      <div className="flex gap-mdt-2">
        <Button size={actionSize} onClick={toWorkbench} aria-label={`Open ${title} in Workbench`}>
          Open in Workbench
        </Button>
        {renderOverflow()}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-mdt-2">
      <Button size={actionSize} onClick={toWorkbench} aria-label={`Open ${title} in Workbench`}>
        Open in Workbench
      </Button>
      {renderOverflow()}
    </div>
  );
}
