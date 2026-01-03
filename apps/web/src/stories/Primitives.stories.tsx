import type { Meta, StoryObj } from "@storybook/react";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Row, Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { CodeText, Text } from "@/components/ui/Text";

const meta: Meta = {
  title: "Foundations/Primitives",
};

export default meta;
type Story = StoryObj;

export const LayoutTypographyV2: Story = {
  render: () => (
    <Container size="sm" padding="md">
      <Surface padding="lg">
        <Stack gap={4}>
          <Heading level="display">Layout &amp; Typography (V2)</Heading>
          <Text tone="muted">
            These primitives are the foundation for all V2 surfaces. They consume semantic tokens only, so global
            rethemes are a token edit.
          </Text>
          <Heading level="h1">Heading 1</Heading>
          <Heading level="h2">Heading 2</Heading>
          <Heading level="h3">Heading 3</Heading>
          <Text>Default body text</Text>
          <Text size="bodySm" tone="muted">
            Small muted body text for supporting copy.
          </Text>
          <CodeText>const agents = &quot;md&quot;;</CodeText>
          <Row gap={2}>
            <Surface tone="subtle" padding="sm">
              Subtle surface
            </Surface>
            <Surface tone="strong" padding="sm">
              Strong surface
            </Surface>
          </Row>
        </Stack>
      </Surface>
    </Container>
  ),
};

