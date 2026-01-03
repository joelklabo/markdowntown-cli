import { Card } from "@/components/ui/Card";

type Props = {
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE" | string | null;
  type: "snippet" | "template" | "file";
};

export function DetailWarning({ visibility, type }: Props) {
  const level = visibility?.toUpperCase?.();
  if (!level || level === "PUBLIC") return null;

  const copy = level === "PRIVATE" ? "Private" : "Unlisted";

  return (
    <Card
      tone="subtle"
      className="flex items-start gap-mdt-3 border-[color:var(--mdt-color-warning)]/50 bg-[color:var(--mdt-color-warning)]/10 text-body-sm text-mdt-text"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden>⚠️</span>
      <div className="space-y-mdt-2">
        <p className="font-semibold">{copy} {type}</p>
        <p className="text-mdt-muted">
          This {type} is {copy.toLowerCase()} — share carefully. Only people with the link should access it.
        </p>
      </div>
    </Card>
  );
}
