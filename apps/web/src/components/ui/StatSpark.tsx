import { cn } from "@/lib/cn";

type SparkProps = {
  values: number[];
  colorVar?: string;
  className?: string;
  label?: string;
};

/**
 * Tiny sparkline using CSS gradients (no SVG) for lightweight stats chips.
 */
export function StatSpark({ values, colorVar = "var(--mdt-data-1)", className, label }: SparkProps) {
  if (!values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const norm = (v - min) / range;
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - norm * 100;
      return `${x}% ${y}%`;
    })
    .join(", ");

  return (
    <div className={cn("flex items-center gap-mdt-2", className)} aria-label={label ?? "Sparkline"}>
      <div
        className="h-8 w-24 rounded-mdt-md border border-mdt-border bg-gradient-to-b from-mdt-surface to-mdt-surface-subtle"
        style={{
          backgroundImage: `linear-gradient(${colorVar}, ${colorVar}), linear-gradient(to bottom, var(--mdt-color-surface), var(--mdt-color-surface-subtle))`,
          backgroundRepeat: "no-repeat, no-repeat",
          backgroundSize: "100% 100%, 100% 100%",
          maskImage: `polygon(${points})`,
          WebkitMaskImage: `polygon(${points})`,
        }}
      />
      {label && <span className="text-caption text-mdt-muted">{label}</span>}
    </div>
  );
}
