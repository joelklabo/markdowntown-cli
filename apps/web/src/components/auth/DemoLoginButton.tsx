"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { emitCityWordmarkEvent } from "@/components/wordmark/sim/bridge";

type Props = {
  password: string;
  callbackUrl?: string;
  wordmarkMethod?: "oauth" | "password" | "sso";
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

export function DemoLoginButton({
  password,
  callbackUrl = "/",
  wordmarkMethod,
  variant = "secondary",
  size = "md",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (wordmarkMethod) emitCityWordmarkEvent({ type: "login", method: wordmarkMethod });
    setLoading(true);
    setError(null);
    const res = await signIn("demo", {
      password,
      callbackUrl,
      redirect: true,
    });
    if (res?.error) {
      setError("Demo sign-in failed. Check the password and try again.");
      setLoading(false);
    }
  }

  return (
    <div className={`space-y-mdt-2 w-full ${className ?? ""}`.trim()}>
      <Button className="w-full" onClick={handleClick} disabled={loading} variant={variant} size={size}>
        {loading ? "Signing in…" : "Sign in with demo account"}
      </Button>
      {error && (
        <Text size="bodySm" className="text-[color:var(--mdt-color-danger)]">
          {error}
        </Text>
      )}
      <Text size="caption" tone="muted">
        Uses a local demo user; no GitHub account required.
      </Text>
    </div>
  );
}
