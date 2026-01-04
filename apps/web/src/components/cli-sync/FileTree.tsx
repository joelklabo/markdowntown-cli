import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
export type CliFileTreeProps = {
  paths: string[];
  selectedPath?: string | null;
  emptyLabel?: string;
};

export function FileTree({ paths, selectedPath, emptyLabel = "No files in this snapshot." }: CliFileTreeProps) {
  const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));

  return (
    <Card padding="lg" tone="raised" className="space-y-mdt-4">
      <Stack gap={1}>
        <Text size="caption" tone="muted" className="uppercase tracking-wide">
          File tree
        </Text>
        <Row align="center" justify="between" wrap className="gap-mdt-3">
          <Heading level="h3">Snapshot files</Heading>
          <Pill tone="gray">{paths.length} files</Pill>
        </Row>
      </Stack>
      {sortedPaths.length === 0 ? (
        <Text tone="muted" size="bodySm">
          {emptyLabel}
        </Text>
      ) : (
        <ul className="space-y-1">
          {sortedPaths.map((pathName) => {
            const isSelected = pathName === selectedPath;
            return (
              <li key={pathName}>
                <div
                  className={[
                    "rounded-mdt-md border px-mdt-2 py-mdt-1 text-caption font-mono",
                    isSelected
                      ? "border-mdt-primary bg-mdt-primary/10 text-mdt-text"
                      : "border-transparent text-mdt-muted",
                  ].join(" ")}
                >
                  {pathName}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
