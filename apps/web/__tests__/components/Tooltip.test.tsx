import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "@/components/ui/Tooltip";

describe("Tooltip", () => {
  it("shows content on hover", async () => {
    render(
      <Tooltip content="Tip text">
        <button>Hover me</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText("Hover me"));

    const tips = await screen.findAllByText("Tip text");
    expect(tips.length).toBeGreaterThan(0);
  });
});

