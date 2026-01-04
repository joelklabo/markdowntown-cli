import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { TextArea } from "@/components/ui/TextArea";

export type RepoEditorProps = {
  filePath: string;
  content: string;
  hasUnsavedEdits?: boolean;
};

export function Editor({ filePath, content, hasUnsavedEdits = false }: RepoEditorProps) {
  return (
    <Card padding="lg" tone="raised" className="space-y-mdt-4">
      <Stack gap={1}>
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          Editor
        </Text>
        <Row align="center" justify="between" wrap className="gap-mdt-3">
          <Heading level="h3">Working copy</Heading>
          <Text size="caption" tone="muted" className={hasUnsavedEdits ? "text-mdt-danger" : undefined}>
            {hasUnsavedEdits ? "Unsaved edits" : "Synced with snapshot"}
          </Text>
        </Row>
      </Stack>

      <div className="overflow-hidden rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle shadow-mdt-sm">
        <div className="border-b border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-caption font-mono text-mdt-text">
          {filePath}
        </div>
        <TextArea
          value={content}
          readOnly
          className="min-h-[280px] resize-none font-mono text-xs leading-relaxed"
        />
      </div>

      <Row align="center" justify="between" wrap className="gap-mdt-3">
        <Text size="caption" tone="muted">
          Edits are staged locally until you create a patch for the CLI.
        </Text>
        <Button size="sm">Create patch</Button>
      </Row>
    </Card>
  );
}
