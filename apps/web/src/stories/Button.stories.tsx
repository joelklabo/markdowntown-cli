import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost"] },
    size: { control: "select", options: ["xs", "sm", "md", "lg"] },
  },
  args: {
    children: "Click me",
    variant: "primary",
    size: "md",
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = {
  args: { variant: "secondary" },
};
export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="xs">
        XS
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton aria-label="Secondary" variant="secondary">
        ?
      </IconButton>
      <IconButton aria-label="Primary" variant="primary">
        ⭐
      </IconButton>
      <IconButton aria-label="Ghost" variant="ghost">
        ↗
      </IconButton>
    </div>
  ),
};
