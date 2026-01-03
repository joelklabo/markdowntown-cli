"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { trackHomeCtaClick } from "@/lib/analytics";
import { HomeTrackedButton } from "@/components/home/HomeTrackedButton";

type CtaLink = {
  id: string;
  label: string;
  href: string;
};

export type HomeCtaClusterProps = React.HTMLAttributes<HTMLDivElement> & {
  primary: CtaLink;
  secondary?: CtaLink;
  tertiary?: CtaLink;
  placement?: string;
  align?: "left" | "center" | "right";
};

export function HomeCtaCluster({
  primary,
  secondary,
  tertiary,
  placement = "hero",
  align = "left",
  className,
  ...props
}: HomeCtaClusterProps) {
  const rowAlign =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";

  return (
    <div className={cn("space-y-mdt-2", className)} {...props}>
      <Row wrap gap={2} className={rowAlign}>
        <HomeTrackedButton
          label={primary.label}
          href={primary.href}
          ctaId={primary.id}
          placement={placement}
          slot="primary"
          size="lg"
          className="shadow-mdt-lg"
        />
        {secondary ? (
          <HomeTrackedButton
            label={secondary.label}
            href={secondary.href}
            ctaId={secondary.id}
            placement={placement}
            slot="secondary"
            size="lg"
            variant="secondary"
            className="shadow-mdt-sm"
          />
        ) : null}
      </Row>
      {tertiary ? (
        <Text
          size="caption"
          tone="muted"
          className={align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}
        >
          <Link
            href={tertiary.href}
            className="font-medium text-mdt-text underline decoration-mdt-border-strong underline-offset-4"
            onClick={() =>
              trackHomeCtaClick({
                cta: tertiary.id,
                href: tertiary.href,
                placement,
                slot: "tertiary",
              })
            }
          >
            {tertiary.label}
          </Link>
        </Text>
      ) : null}
    </div>
  );
}
