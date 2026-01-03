import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SnippetTabs } from "@/components/snippet/SnippetTabs";

describe("SnippetTabs", () => {
  it("switches tabs and copies active content", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<SnippetTabs title="My Snippet" rendered="Rendered body" raw="RAW_CONTENT" />);

    expect(screen.getByText("Rendered body")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /raw/i }));
    expect(await screen.findByText("RAW_CONTENT")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /copy raw/i }));
    expect(writeText).toHaveBeenCalledWith("RAW_CONTENT");
  });
});
