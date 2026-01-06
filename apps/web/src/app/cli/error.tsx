"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export default function CliErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CLI Dashboard Error:", error);
  }, [error]);

  return (
    <Container className="py-mdt-20">
      <Card padding="lg" tone="raised" className="text-center">
        <Stack gap={4} align="center">
          <div className="rounded-full bg-mdt-red-subtle p-mdt-4 text-mdt-red">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <Stack gap={2}>
            <Heading level="h2">Something went wrong</Heading>
            <Text tone="muted">
              We couldn't load your CLI sync dashboard. This might be a temporary connection issue.
            </Text>
          </Stack>
          <div className="flex gap-mdt-3">
            <Button onClick={() => reset()} variant="primary">
              Try again
            </Button>
            <Button asChild variant="secondary">
              <a href="/">Go home</a>
            </Button>
          </div>
        </Stack>
      </Card>
    </Container>
  );
}

function Card({ children, padding, tone, className }: any) {
  // Simple proxy for UI Card to avoid complex imports in error boundary if needed
  return <div className={`rounded-mdt-lg border border-mdt-border bg-mdt-surface ${className}`}>{children}</div>;
}
