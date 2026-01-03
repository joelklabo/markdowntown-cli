import React from "react";
import { cn } from "@/lib/cn";

type SparklineProps = {
  points: number[];
  stroke?: string;
  className?: string;
  ariaLabel?: string;
};

export function Sparkline({ points, stroke = "var(--mdt-color-primary)", className, ariaLabel }: SparklineProps) {
  if (!points.length) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const norm = (v: number) => ((v - min) / (max - min || 1)) * 100;
  const d = points
    .map((v, i) => `${(i / Math.max(points.length - 1, 1)) * 100},${100 - norm(v)}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={ariaLabel ?? "Sparkline"}
      className={cn("h-8 w-full text-mdt-primary", className)}
    >
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={d} />
    </svg>
  );
}

type BarProps = {
  values: number[];
  className?: string;
  ariaLabel?: string;
};

export function MiniBars({ values, className, ariaLabel }: BarProps) {
  if (!values.length) return null;
  const max = Math.max(...values);
  return (
    <div
      className={cn("flex h-16 items-end gap-1", className)}
      role="img"
      aria-label={ariaLabel ?? "Mini bar chart"}
    >
      {values.map((v, idx) => (
        <div
          key={idx}
          className="flex-1 rounded-mdt-sm bg-[color:var(--mdt-color-primary-soft)]"
          style={{ height: `${(v / (max || 1)) * 100}%` }}
        />
      ))}
    </div>
  );
}

type DonutProps = {
  value: number; // 0-1
  className?: string;
  ariaLabel?: string;
};

export function MiniDonut({ value, className, ariaLabel }: DonutProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const circumference = 2 * Math.PI * 45;
  const offset = circumference * (1 - clamped);
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={ariaLabel ?? "Completion donut"}
      className={cn("h-12 w-12", className)}
    >
      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--mdt-color-surface-strong)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="var(--mdt-color-primary)"
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fontSize="18"
        fill="var(--mdt-color-text)"
        fontWeight="600"
      >
        {Math.round(clamped * 100)}%
      </text>
    </svg>
  );
}
