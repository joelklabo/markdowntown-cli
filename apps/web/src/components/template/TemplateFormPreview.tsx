"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Input } from "@/components/ui/Input";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { renderTemplateBody } from "@/lib/renderTemplate";

export type TemplateField = {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
};

type Props = {
  title: string;
  body: string;
  fields: TemplateField[];
};

export function TemplateFormPreview({ title, body, fields }: Props) {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        fields.map((f) => [f.name, f.placeholder ?? (f.required ? "" : "")])
      ),
    [fields]
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const preview = useMemo(() => renderTemplateBody(body, values), [body, values]);

  return (
    <Surface padding="lg" className="grid gap-mdt-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-mdt-4">
        <div className="flex flex-wrap items-center justify-between gap-mdt-2">
          <div className="space-y-mdt-1">
            <Heading level="h3" as="h3">Fill placeholders</Heading>
            <Text size="bodySm" tone="muted">
              Preview updates as you type - no save required.
            </Text>
          </div>
          <Pill tone="gray" className="text-xs">
            Live preview
          </Pill>
        </div>
        <div className="space-y-mdt-3">
          {fields.map((field) => (
            <label
              key={field.name}
              className="flex flex-col gap-mdt-1 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 focus-within:border-[color:var(--mdt-color-border-strong)] focus-within:ring-2 focus-within:ring-mdt-ring focus-within:ring-offset-2 focus-within:ring-offset-mdt-surface"
            >
              <div className="flex items-center justify-between">
                <Text as="span" size="bodySm" weight="semibold">
                  {field.label ?? field.name}
                </Text>
                {field.required && (
                  <Text as="span" size="caption" tone="muted">
                    Required
                  </Text>
                )}
              </div>
              <Input
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
              />
              {field.description && (
                <Text size="caption" tone="muted">{field.description}</Text>
              )}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-mdt-2">
          <Button size="xs" onClick={() => setValues(initial)}>
            Reset
          </Button>
          <Button variant="secondary" size="xs" onClick={() => navigator.clipboard.writeText(preview)}>
            Copy preview
          </Button>
        </div>
      </div>
      <div className="space-y-mdt-3">
        <Heading level="h3" as="h3">Live preview</Heading>
        <Surface tone="subtle" padding="md" className="min-h-[240px] space-y-mdt-3 text-body-sm leading-6 shadow-inner">
          <Text weight="semibold">{title}</Text>
          <pre className="whitespace-pre-wrap font-sans text-mdt-text">{preview}</pre>
        </Surface>
      </div>
    </Surface>
  );
}
