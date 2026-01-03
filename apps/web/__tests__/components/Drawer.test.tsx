import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerCloseButton, DrawerTrigger } from "@/components/ui/Drawer";

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button type="button">Open drawer</button>
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

describe("Drawer", () => {
  it("opens and closes", async () => {
    render(<DrawerHarness />);

    expect(screen.queryByTestId("drawer-body")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /open drawer/i }));
    expect(screen.getByTestId("drawer-body")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /close drawer/i }));
    expect(screen.queryByTestId("drawer-body")).not.toBeInTheDocument();
  });
});

