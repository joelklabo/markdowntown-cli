import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet, SheetContent, SheetSide, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";

function TestSheet({ side = "right" }: { side?: SheetSide }) {
  return (
    <Sheet>
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent side={side}>
        <SheetTitle className="sr-only">Sheet</SheetTitle>
        <div>Panel content</div>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("opens and closes with Escape", async () => {
    render(<TestSheet />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on outside click", async () => {
    render(<TestSheet />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const overlay = document.querySelector(".mdt-radix-overlay");
    expect(overlay).toBeTruthy();
    await userEvent.click(overlay as Element);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selects placement classes", async () => {
    render(<TestSheet side="bottom" />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("bottom-0");
    expect(dialog).toHaveClass("mdt-radix-panel-slide");
  });
});
