import { cn } from "@/lib/cn";
import React from "react";

type AvatarProps = {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  alt?: string;
} & React.HTMLAttributes<HTMLDivElement>;

function initialsFromName(name?: string) {
  if (!name) return "MT";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "MT";
}

export function Avatar({ name, src, size = "md", alt, className, ...props }: AvatarProps) {
  const sizeMap: Record<typeof size, string> = {
    sm: "h-8 w-8 text-caption",
    md: "h-10 w-10 text-body-sm",
    lg: "h-12 w-12 text-body",
  };
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-mdt-border bg-mdt-surface text-mdt-text font-semibold",
        sizeMap[size],
        className
      )}
      aria-label={alt ?? name ?? "Avatar"}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? name ?? "Avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initialsFromName(name)}</span>
      )}
    </div>
  );
}
