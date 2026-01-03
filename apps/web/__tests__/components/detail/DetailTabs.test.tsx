import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailTabs } from "@/components/detail/DetailTabs";

describe("DetailTabs", () => {
  it("renders rendered content by default and switches to raw", async () => {
    const user = userEvent.setup();
    render(
      <DetailTabs
        title="Sample"
        rendered="Rendered body"
        raw="RAW BODY"
      />
    );

    expect(screen.getByText("Rendered body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy rendered/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Raw" }));
    expect(screen.getByText("RAW BODY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy raw/i })).toBeInTheDocument();
  });
});
