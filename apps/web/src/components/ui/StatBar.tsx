import { cn } from "@/lib/cn";

type StatBarProps = {
  label: string;
  value: number;
  max?: number;
  colorVar?: string;
  className?: string;
};

export function StatBar({ label, value, max = 100, colorVar = "var(--mdt-data-2)", className }: StatBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className={cn("space-y-mdt-1 rounded-mdt-md border border-mdt-border bg-mdt-surface p-mdt-3", className)}>
      <div className="flex items-center justify-between text-body-sm text-mdt-muted">
        <span>{label}</span>
        <span className="font-semibold text-mdt-text">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-mdt-surface-strong">
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: colorVar, transition: "width var(--mdt-motion-base) ease-out" }}
        />
      </div>
    </div>
  );
}
