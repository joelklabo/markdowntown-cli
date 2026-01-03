import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerCloseButton, DrawerTrigger } from "@/components/ui/Drawer";
import { Text, CodeText } from "@/components/ui/Text";
import { Heading } from "@/components/ui/Heading";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { useState } from "react";

function DrawerHarness() {
  const [open, setOpen] = useState(true);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button aria-label="open">Open</button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Drawer Title</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>
        <div data-testid="drawer-body">Hello drawer</div>
      </DrawerContent>
    </Drawer>
  );
}

describe("UI primitives", () => {

  it("renders form controls with size variants", () => {
    render(
      <div>
        <Input placeholder="Email" data-testid="input-md" />
        <Input size="xs" placeholder="Email xs" data-testid="input-xs" />
        <TextArea placeholder="Notes" data-testid="textarea-md" />
        <TextArea size="xs" placeholder="Notes xs" data-testid="textarea-xs" />
        <Select data-testid="select-md">
          <option value="one">One</option>
        </Select>
        <Select size="sm" data-testid="select-sm">
          <option value="two">Two</option>
        </Select>
      </div>
    );
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();

    expect(screen.getByTestId("input-md").className).toContain("h-mdt-11");
    expect(screen.getByTestId("input-xs").className).toContain("h-mdt-8");

    expect(screen.getByTestId("textarea-md").className).toContain("px-mdt-4");
    expect(screen.getByTestId("textarea-xs").className).toContain("px-mdt-2");

    expect(screen.getByTestId("select-md").className).toContain("h-mdt-11");
    expect(screen.getByTestId("select-sm").className).toContain("h-mdt-10");
  });

  it("renders V2 typography primitives", () => {
    render(
      <div>
        <Heading level="h2">Title</Heading>
        <Text>Body</Text>
        <CodeText>code</CodeText>
      </div>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
  });

  it("renders V2 layout primitives", () => {
    render(
      <Container>
        <Surface>
          <Stack>
            <div>one</div>
            <div>two</div>
          </Stack>
        </Surface>
      </Container>
    );
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  it("switches tabs with Radix Tabs wrapper", async () => {
    render(
      <TabsRoot defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Tab one content</TabsContent>
        <TabsContent value="two">Tab two content</TabsContent>
      </TabsRoot>
    );
    expect(screen.getByText("Tab one content")).toBeVisible();
    await userEvent.click(screen.getByText("Two"));
    expect(screen.getByText("Tab two content")).toBeVisible();
  });

  it("shows tooltip on hover", async () => {
    render(
      <Tooltip content="Tip text">
        <button>Hover me</button>
      </Tooltip>
    );
    await userEvent.hover(screen.getByText("Hover me"));
    const tips = await screen.findAllByText("Tip text");
    expect(tips.length).toBeGreaterThan(0);
  });

  it("opens and closes drawer", async () => {
    render(<DrawerHarness />);
    expect(screen.getByTestId("drawer-body")).toBeInTheDocument();
    await userEvent.click(screen.getByText("×"));
    expect(screen.queryByTestId("drawer-body")).not.toBeInTheDocument();
  });
});
