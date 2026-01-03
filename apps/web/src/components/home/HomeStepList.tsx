import React from "react";
import { cn } from "@/lib/cn";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";

export type HomeStep = {
  title: string;
  description?: string;
};

export type HomeStepListProps = React.HTMLAttributes<HTMLOListElement> & {
  steps: HomeStep[];
};

export function HomeStepList({ steps, className, ...props }: HomeStepListProps) {
  return (
    <ol className={cn("grid gap-mdt-4", className)} {...props}>
      {steps.map((step, idx) => (
        <li key={step.title}>
          <Surface tone="subtle" padding="sm" className="flex items-start gap-mdt-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--mdt-color-primary-soft)] text-sm font-semibold text-[color:var(--mdt-color-primary-strong)]"
              aria-hidden
            >
              {idx + 1}
            </span>
            <Stack gap={1}>
              <Text weight="semibold">{step.title}</Text>
              {step.description ? (
                <Text size="bodySm" tone="muted">
                  {step.description}
                </Text>
              ) : null}
            </Stack>
          </Surface>
        </li>
      ))}
    </ol>
  );
}
