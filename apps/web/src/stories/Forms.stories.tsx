import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Radio } from "@/components/ui/Radio";

const meta: Meta = {
  title: "Primitives/Forms",
};

export default meta;
type Story = StoryObj;

export const Fields: Story = {
  render: () => (
    <div className="space-y-4 max-w-md">
      <Input placeholder="Input" />
      <TextArea placeholder="Textarea" />
      <Select defaultValue="alpha">
        <option value="alpha">Alpha</option>
        <option value="beta">Beta</option>
      </Select>
    </div>
  ),
};

export const Choices: Story = {
  render: () => (
    <div className="space-y-3">
      <Checkbox>Keep me posted</Checkbox>
      <div className="flex gap-4">
        <Radio name="speed" value="slow" label="Slow" defaultChecked />
        <Radio name="speed" value="fast" label="Fast" />
      </div>
    </div>
  ),
};
