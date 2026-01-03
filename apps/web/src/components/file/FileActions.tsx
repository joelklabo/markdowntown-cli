"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";

type Props = {
  id: string;
  slug?: string;
  title: string;
  content: string;
  builderHref?: string;
  variant?: "inline" | "bar";
};

export function FileActions({ id, slug, title, content, builderHref, variant = "inline" }: Props) {
  const filename = `${slug ?? id}.md`;
  const actionSize = variant === "bar" ? "sm" : "xs";

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      track("file_copy", { id, slug, title });
    } catch (err) {
      console.warn("file copy failed", err);
    }
  }

  function download() {
    try {
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      track("file_download", { id, slug, title });
    } catch (err) {
      console.warn("file download failed", err);
    }
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.origin + `/files/${slug ?? id}` : `/files/${slug ?? id}`;
    const shareTitle = `${title} | mark downtown`;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      track("file_share", { id, slug, title });
    } catch (err) {
      console.warn("file share failed", err);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {builderHref && (
        <Button size={actionSize} asChild>
          <Link href={builderHref}>Open in Workbench</Link>
        </Button>
      )}
      <Button variant={builderHref ? "secondary" : undefined} size={actionSize} onClick={copy}>
        Copy
      </Button>
      <Button variant="secondary" size={actionSize} onClick={download}>
        Download
      </Button>
      <Button variant="ghost" size={actionSize} onClick={share} aria-label={`Share ${title}`}>
        Share
      </Button>
    </div>
  );
}
