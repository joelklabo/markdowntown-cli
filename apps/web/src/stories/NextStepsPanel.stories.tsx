import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";

const severityTone = {
  error: "danger",
  warning: "warning",
  info: "info",
  ready: "success",
} as const;

const severityLabel = {
  error: "Error",
  warning: "Warning",
  info: "Info",
  ready: "Ready",
} as const;

type Step = {
  id: string;
  severity: keyof typeof severityTone;
  title: string;
  body: string;
  primaryAction?: string;
  secondaryActions?: string[];
};

type NextStepsPanelPreviewProps = {
  title?: string;
  subtitle?: string;
  steps: Step[];
};

function NextStepsPanelPreview({
  title = "Next steps",
  subtitle = "Start here to fix the biggest issue.",
  steps,
}: NextStepsPanelPreviewProps) {
  return (
    <Card className="w-full max-w-[760px] border border-mdt-border p-mdt-6">
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level="h3">{title}</Heading>
          {subtitle ? (
            <Text size="bodySm" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </Stack>
        <Stack gap={3}>
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex flex-col gap-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface px-mdt-4 py-mdt-3"
            >
              <div className="flex items-start gap-mdt-3">
                <Badge tone={severityTone[step.severity]}>{severityLabel[step.severity]}</Badge>
                <Stack gap={1}>
                  <Text weight="semibold">{step.title}</Text>
                  <Text size="bodySm" tone="muted">
                    {step.body}
                  </Text>
                </Stack>
              </div>
              {(step.primaryAction || step.secondaryActions?.length) ? (
                <div className="flex flex-wrap gap-mdt-2">
                  {step.primaryAction ? (
                    <Button size="sm" variant="primary">
                      {step.primaryAction}
                    </Button>
                  ) : null}
                  {step.secondaryActions?.map((label) => (
                    <Button key={label} size="sm" variant="secondary">
                      {label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

const meta: Meta<typeof NextStepsPanelPreview> = {
  title: "Atlas/NextStepsPanel",
  component: NextStepsPanelPreview,
};

export default meta;

type Story = StoryObj<typeof NextStepsPanelPreview>;

export const MissingRoot: Story = {
  args: {
    steps: [
      {
        id: "missing-root",
        severity: "error",
        title: "Add the root instruction file",
        body: "This tool won't load any instructions without a root file.",
        primaryAction: "Copy template",
        secondaryActions: ["Open docs"],
      },
      {
        id: "missing-cwd",
        severity: "warning",
        title: "Set the current directory (cwd)",
        body: "Ancestor scans depend on where the tool runs. Set cwd so we load the right instructions.",
        primaryAction: "Set cwd",
      },
    ],
  },
};

export const StaleResults: Story = {
  args: {
    steps: [
      {
        id: "stale",
        severity: "warning",
        title: "Results are out of date",
        body: "Your inputs changed. Re-run to refresh guidance.",
        primaryAction: "Refresh results",
        secondaryActions: ["Copy summary"],
      },
      {
        id: "mixed-tools",
        severity: "warning",
        title: "Multiple tool formats detected",
        body: "You may be scanning the wrong tool or have extra files for other CLIs.",
        primaryAction: "Switch tool",
        secondaryActions: ["Review extra files"],
      },
    ],
  },
};

export const Ready: Story = {
  args: {
    steps: [
      {
        id: "ready",
        severity: "ready",
        title: "You're ready to go",
        body: "These files should load for the selected tool. You can share the summary or continue.",
        primaryAction: "Copy summary",
        secondaryActions: ["Download report"],
      },
    ],
  },
};

export const Gallery: Story = {
  render: () => (
    <Stack gap={6}>
      <NextStepsPanelPreview {...(MissingRoot.args as NextStepsPanelPreviewProps)} />
      <NextStepsPanelPreview {...(StaleResults.args as NextStepsPanelPreviewProps)} />
      <NextStepsPanelPreview {...(Ready.args as NextStepsPanelPreviewProps)} />
    </Stack>
  ),
};
