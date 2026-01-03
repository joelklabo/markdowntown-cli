import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { TemplateFormPreview } from "@/components/template/TemplateFormPreview";

const writeText = vi.fn();

describe("TemplateFormPreview", () => {
  beforeAll(() => {
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
  });

  beforeEach(() => writeText.mockClear());

  it("renders live preview, resets, and copies output", async () => {
    render(
      <TemplateFormPreview
        title="Greeting"
        body="Hello {{name}} from {{company}}"
        fields={[
          { name: "name", placeholder: "Ada", required: true },
          { name: "company", placeholder: "OpenAI" },
        ]}
      />
    );

    expect(screen.getByText(/hello ada from openai/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Grace" } });
    expect(await screen.findByText(/hello grace from openai/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(await screen.findByText(/hello ada from openai/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy preview/i }));
    expect(writeText).toHaveBeenCalledWith("Hello Ada from OpenAI");
  });
});
