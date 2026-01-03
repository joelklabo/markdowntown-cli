import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

function TabsHarness() {
  return (
    <TabsRoot defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Panel one</TabsContent>
      <TabsContent value="two">Panel two</TabsContent>
      <TabsContent value="three">Panel three</TabsContent>
    </TabsRoot>
  );
}

describe("Tabs", () => {
  it("switches active tab on click", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    expect(screen.getByText("Panel one")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Panel two")).toBeVisible();
  });

  it("supports keyboard focus", async () => {
    render(<TabsHarness />);

    await userEvent.tab();
    const first = screen.getByRole("tab", { name: "One" });
    expect(first).toHaveFocus();
  });

  it("applies tap target sizing classes", () => {
    render(<TabsHarness />);
    const tab = screen.getByRole("tab", { name: "One" });
    expect(tab.className).toContain("min-h-[var(--mdt-space-11)]");
  });
});
