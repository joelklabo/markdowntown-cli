import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export function SkillsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card className="space-y-mdt-4 text-center" padding="lg" tone="raised">
      <Heading level="h3" as="h2">
        No skills match those filters
      </Heading>
      <Text tone="muted" className="mx-auto max-w-xl">
        {hasFilters
          ? "Try clearing filters or searching fewer tags. You can also create a skill in Workbench to share with your team."
          : "Get started by creating a new skill in Workbench, or check back soon for more."}
      </Text>
      <div className="flex flex-wrap justify-center gap-mdt-2">
        <Button size="sm" asChild>
          <Link href="/workbench">Open Workbench</Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link href="/skills">Clear filters</Link>
        </Button>
      </div>
    </Card>
  );
}
