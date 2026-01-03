import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tag } from "@/components/ui/Tag";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import React from "react";

const meta: Meta = {
  title: "Primitives/Data Display",
};

export default meta;
type Story = StoryObj;

export const BadgesTags: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge tone="primary">Primary</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="danger">Danger</Badge>
      <Badge tone="info">Info</Badge>
      <Tag label="Filter: AI" />
      <Tag label="Removable" onRemove={() => alert("Removed")} />
      <Pill tone="primary">Primary pill</Pill>
      <Pill tone="blue">Blue pill</Pill>
    </div>
  ),
};

export const Cards: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[1, 2, 3].map((n) => (
        <Card key={n} className="space-y-2">
          <div className="flex items-center gap-3">
            <Avatar name={`User ${n}`} />
            <div>
              <p className="font-semibold text-mdt-text">User {n}</p>
              <p className="text-sm text-mdt-text-muted">Subtitle</p>
            </div>
          </div>
          <p className="text-sm text-mdt-text-muted">
            Descriptive copy about this content block. Shows surface + border tokens.
          </p>
        </Card>
      ))}
    </div>
  ),
};

export const PaginationControl: Story = {
  render: function PaginationStory() {
    const [page, setPage] = React.useState(2);
    return <Pagination current={page} total={5} onPageChange={setPage} />;
  },
};
