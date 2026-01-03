import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const textVariants = cva("", {
  variants: {
    size: {
      body: "text-body",
      bodySm: "text-body-sm",
      caption: "text-caption",
    },
    tone: {
      default: "text-mdt-text",
      muted: "text-mdt-muted",
      subtle: "text-mdt-text-subtle",
      onStrong: "text-mdt-text-on-strong",
    },
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    leading: {
      tight: "leading-tight",
      normal: "leading-normal",
      relaxed: "leading-relaxed",
    },
    tracking: {
      tight: "tracking-tight",
      normal: "tracking-normal",
      wide: "tracking-wide",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    size: "body",
    tone: "default",
    weight: "regular",
  },
});

type TextVariants = VariantProps<typeof textVariants>;

type PolymorphicProps<C extends React.ElementType, Props> =
  Props & { as?: C } & Omit<React.ComponentPropsWithoutRef<C>, keyof Props | "as">;

export type TextProps<C extends React.ElementType = "p"> = PolymorphicProps<C, TextVariants>;

export function Text<C extends React.ElementType = "p">({
  as,
  size,
  tone,
  weight,
  leading,
  tracking,
  align,
  className,
  ...props
}: TextProps<C>) {
  const Comp = (as ?? "p") as React.ElementType;
  return (
    <Comp
      className={cn(textVariants({ size, tone, weight, leading, tracking, align }), className)}
      {...props}
    />
  );
}

export type CodeTextProps<C extends React.ElementType = "code"> = PolymorphicProps<C, TextVariants>;

export function CodeText<C extends React.ElementType = "code">({
  as,
  size = "bodySm",
  tone,
  weight,
  leading,
  tracking,
  align,
  className,
  ...props
}: CodeTextProps<C>) {
  const Comp = (as ?? "code") as React.ElementType;
  return (
    <Comp
      className={cn(textVariants({ size, tone, weight, leading, tracking, align }), "font-mono", className)}
      {...props}
    />
  );
}
