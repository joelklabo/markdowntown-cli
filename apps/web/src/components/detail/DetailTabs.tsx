"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/Tabs";

type Props = {
  title: string;
  rendered: string;
  raw: string;
  copyLabel?: string;
};

export function DetailTabs({ title, rendered, raw, copyLabel = "Copy" }: Props) {
  const [tab, setTab] = useState<"rendered" | "raw">("rendered");

  function copyCurrent() {
    const content = tab === "raw" ? raw : rendered;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      const result = navigator.clipboard.writeText(content);
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {});
      }
    }
  }

  return (
    <Card padding="lg">
      <TabsRoot value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-mdt-4">
        <div className="flex flex-wrap items-center justify-between gap-mdt-3">
          <TabsList className="w-auto">
            <TabsTrigger value="rendered">Rendered</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>
          <Button size="sm" variant="secondary" onClick={copyCurrent}>
            {copyLabel} {tab}
          </Button>
        </div>

        <TabsContent value="rendered" className="!mt-0 border-none bg-transparent p-0 shadow-none">
          <Card tone="subtle" padding="md" className="space-y-mdt-2">
            <Heading level="h3">
              {title}
            </Heading>
            <Text as="p" size="bodySm" className="whitespace-pre-wrap">
              {rendered}
            </Text>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="!mt-0 border-none bg-transparent p-0 shadow-none">
          <Card tone="subtle" padding="md" className="font-mono text-caption whitespace-pre-wrap text-mdt-text">
            {raw}
          </Card>
        </TabsContent>
      </TabsRoot>
    </Card>
  );
}
