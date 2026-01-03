"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import type { AtlasPlatformId } from "@/lib/atlas/types";

type AtlasExampleFileRef = {
  platformId: AtlasPlatformId;
  fileName: string;
};

type DownloadExamplesZipButtonProps = {
  files: AtlasExampleFileRef[];
  downloadName: string;
};

export function DownloadExamplesZipButton({ files, downloadName }: DownloadExamplesZipButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const disabled = loading || files.length === 0;

  const handleDownload = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/atlas/examples/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error ?? `Download failed (${res.status})`;
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Download zip failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={handleDownload}>
      {loading ? "Downloading…" : "Download example zip"}
    </Button>
  );
}

