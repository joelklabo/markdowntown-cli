import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { CodeText, Text } from "@/components/ui/Text";

const meta: Meta = {
  title: "Foundations/Tokens",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const TokensV2: Story = {
  render: () => (
    <div className="p-mdt-6 max-w-4xl">
      <Card className="p-mdt-6">
        <Stack gap={4}>
          <Heading level="h1">Tokens (V2)</Heading>
          <Text tone="muted">
            Design tokens live in <CodeText>src/app/globals.css</CodeText> as a V2 stack: (1) primitive palette, (2)
            semantic roles, (3) component + Tailwind aliases.
          </Text>

          <Heading level="h2">Primitive palette (CSS vars)</Heading>
          <ul className="list-disc pl-mdt-6 space-y-1 text-body-sm text-mdt-text">
            <li>
              Neutrals: <CodeText>--mdt-neutral-0…950</CodeText> (light and dark sets)
            </li>
            <li>
              Brand: <CodeText>--mdt-brand-50…700</CodeText>
            </li>
            <li>
              Accent: <CodeText>--mdt-violet-50…700</CodeText>
            </li>
            <li>
              Status: <CodeText>--mdt-success-*</CodeText>, <CodeText>--mdt-warning-*</CodeText>,{" "}
              <CodeText>--mdt-danger-*</CodeText>, <CodeText>--mdt-info-*</CodeText>
            </li>
          </ul>

          <Heading level="h2">Color roles</Heading>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm text-mdt-text">
              <thead className="text-caption text-mdt-muted">
                <tr>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Token</th>
                  <th className="py-2">Example</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-t border-mdt-border">
                  <td className="py-2 pr-4">Brand</td>
                  <td className="py-2 pr-4">
                    <CodeText>mdt-primary</CodeText>, <CodeText>mdt-primary-strong</CodeText>,{" "}
                    <CodeText>mdt-primary-soft</CodeText>
                  </td>
                  <td className="py-2">Buttons, highlights</td>
                </tr>
                <tr className="border-t border-mdt-border">
                  <td className="py-2 pr-4">Accent</td>
                  <td className="py-2 pr-4">
                    <CodeText>mdt-accent</CodeText>, <CodeText>mdt-accent-soft</CodeText>
                  </td>
                  <td className="py-2">Secondary emphasis</td>
                </tr>
                <tr className="border-t border-mdt-border">
                  <td className="py-2 pr-4">Status</td>
                  <td className="py-2 pr-4">
                    <CodeText>mdt-success</CodeText>, <CodeText>mdt-warning</CodeText>, <CodeText>mdt-danger</CodeText>,{" "}
                    <CodeText>mdt-info</CodeText>
                  </td>
                  <td className="py-2">Toasts, banners</td>
                </tr>
                <tr className="border-t border-mdt-border">
                  <td className="py-2 pr-4">Surfaces</td>
                  <td className="py-2 pr-4">
                    <CodeText>mdt-surface</CodeText>, <CodeText>mdt-surface-subtle</CodeText>,{" "}
                    <CodeText>mdt-surface-strong</CodeText>, <CodeText>mdt-surface-raised</CodeText>,{" "}
                    <CodeText>mdt-overlay</CodeText>
                  </td>
                  <td className="py-2">Cards, panels, overlays</td>
                </tr>
                <tr className="border-t border-mdt-border">
                  <td className="py-2 pr-4">Lines</td>
                  <td className="py-2 pr-4">
                    <CodeText>mdt-border</CodeText>, <CodeText>mdt-border-strong</CodeText>, <CodeText>mdt-ring</CodeText>
                  </td>
                  <td className="py-2">Dividers, focus</td>
                </tr>
                <tr className="border-t border-mdt-border">
                  <td className="py-2 pr-4">Text</td>
                  <td className="py-2 pr-4">
                    <CodeText>mdt-text</CodeText>, <CodeText>mdt-text-muted</CodeText>, <CodeText>mdt-text-subtle</CodeText>,{" "}
                    <CodeText>mdt-text-on-strong</CodeText>
                  </td>
                  <td className="py-2">Copy</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Heading level="h2">Motion &amp; spacing</Heading>
          <ul className="list-disc pl-mdt-6 space-y-1 text-body-sm text-mdt-text">
            <li>
              Durations: <CodeText>duration-mdt-fast|base|slow</CodeText>
            </li>
            <li>
              Easings: <CodeText>ease-mdt-standard|mdt-emphasized</CodeText>
            </li>
            <li>
              Spacing: <CodeText>mdt-0,1,2,3,4,5,6,7,8,9,10,12</CodeText> (4/8 base)
            </li>
            <li>
              Radii: <CodeText>mdt-sm|mdt-md|mdt-lg|mdt-pill</CodeText>
            </li>
            <li>
              Shadows: <CodeText>mdt-sm|mdt-md|mdt-lg|mdt-focus|mdt-glow</CodeText>
            </li>
          </ul>

          <Heading level="h2">Light/Dark</Heading>
          <Text tone="muted">
            Use the Storybook toolbar toggle to flip light/dark. The decorator writes the class to{" "}
            <CodeText>document.documentElement</CodeText> so components render with the correct CSS variables.
          </Text>
        </Stack>
      </Card>
    </div>
  ),
};

