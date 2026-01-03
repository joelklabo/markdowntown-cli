import { Text } from "@/components/ui/Text";

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function SkillParams({ params }: { params?: Record<string, unknown> }) {
  const entries = params ? Object.entries(params) : [];

  if (!entries || entries.length === 0) {
    return (
      <Text size="caption" tone="muted">
        No parameters.
      </Text>
    );
  }

  return (
    <div className="space-y-mdt-2">
      <Text size="caption" tone="muted">
        Parameters
      </Text>
      <div className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
        {entries.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <Text size="caption" className="font-mono text-mdt-text">
              {key}
            </Text>
            <pre className="whitespace-pre-wrap rounded-mdt-sm bg-mdt-surface px-mdt-2 py-mdt-1 text-caption text-mdt-muted">
              {formatValue(value)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
