"use client";

import React from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type CopyButtonProps = {
  text: string;
  label?: string;
  copiedLabel?: string;
  timeoutMs?: number;
  onCopy?: () => void;
} & Omit<ButtonProps, "children" | "onClick">;

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  timeoutMs = 1200,
  onCopy,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => setCopied(false), timeoutMs);
    } catch (err) {
      console.warn("Copy failed", err);
    }
  }

  return (
    <Button type="button" className={cn(className)} onClick={handleCopy} {...props}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
