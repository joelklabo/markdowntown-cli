import { render } from "@testing-library/react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

describe("Card", () => {
  it("renders children", () => {
    const { getByText } = render(
      <Card>
        <span>inside</span>
      </Card>
    );
    expect(getByText("inside")).toBeInTheDocument();
  });
});

describe("Pill", () => {
  it("applies tone class", () => {
    const { getByText } = render(<Pill tone="yellow">Alert</Pill>);
    const el = getByText("Alert");
    expect(el.className).toContain("bg-mdt-accent-soft");
    expect(el.className).toContain("text-mdt-text");
  });

  it("uses semantic status soft tokens for blue tone", () => {
    const { getByText } = render(<Pill tone="blue">Info</Pill>);
    const el = getByText("Info");
    expect(el.className).toContain("mdt-color-info-soft");
    expect(el.className).toContain("mdt-color-info");
  });
});
