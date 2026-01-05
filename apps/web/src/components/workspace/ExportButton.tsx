"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";

interface ExportButtonProps {
  workspaceId: string;
}

export function ExportButton({ workspaceId }: ExportButtonProps) {
  const [isExporting, setIsSaving] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async (format: "zip" | "patch") => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      
      if (format === "zip") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `workspace-${workspaceId}.zip`;
        a.click();
      } else {
        if (res.ok) {
          setExported(true);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="secondary">Export Changes</Button>
      </SheetTrigger>
      <SheetContent>
        <div className="p-6">
          <SheetTitle className="mb-6">Export Workspace Changes</SheetTitle>
          <div className="flex flex-col gap-6">
            <Card padding="md" tone="default">
              <Heading level="h3" className="mb-2">Download ZIP</Heading>
              <Text size="bodySm" tone="muted" className="mb-4">
                Get a full archive of all edited files in this workspace.
              </Text>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleExport("zip")}
                disabled={isExporting}
              >
                Download .zip
              </Button>
            </Card>

            <Card padding="md" tone="default">
              <Heading level="h3" className="mb-2">Create CLI Patches</Heading>
              <Text size="bodySm" tone="muted" className="mb-4">
                Generate patches that you can pull and apply locally using the markdowntown CLI.
              </Text>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => handleExport("patch")}
                disabled={isExporting || exported}
              >
                {exported ? "Patches Created" : "Create Patches"}
              </Button>
              {exported && (
                <Text size="caption" className="mt-2 text-mdt-success font-medium">
                  Success! Run `markdowntown sync` in your repo to apply.
                </Text>
              )}
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
