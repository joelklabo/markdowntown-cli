"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/Button";
import { trackHomeCtaClick } from "@/lib/analytics";

export type HomeTrackedButtonProps = {
  label: string;
  href: string;
  ctaId: string;
  placement: string;
  slot?: "primary" | "secondary" | "tertiary" | "single";
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
};

export function HomeTrackedButton({
  label,
  href,
  ctaId,
  placement,
  slot = "single",
  variant,
  size,
  className,
}: HomeTrackedButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      asChild
    >
      <Link
        href={href}
        onClick={() => trackHomeCtaClick({ cta: ctaId, href, placement, slot })}
      >
        {label}
      </Link>
    </Button>
  );
}
