"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { emitCityWordmarkEvent } from "@/components/wordmark/sim/bridge";

type Props = {
  callbackUrl: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  wordmarkMethod?: "oauth" | "password" | "sso";
};

export function GithubLoginButton({
  callbackUrl,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  className,
  wordmarkMethod,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled || loading) return;
    if (wordmarkMethod) emitCityWordmarkEvent({ type: "login", method: wordmarkMethod });
    setLoading(true);
    await signIn("github", { callbackUrl });
    setLoading(false);
  }

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      className={`whitespace-nowrap ${className ?? ""}`.trim()}
    >
      {loading ? "Redirecting…" : children}
    </Button>
  );
}
