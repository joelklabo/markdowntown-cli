import { render } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders neutral tone", () => {
    const { getByText } = render(<Badge tone="neutral">Neutral</Badge>);
    const el = getByText("Neutral");
    expect(el.className).toContain("mdt-color-surface-subtle");
  });

  it("renders primary tone", () => {
    const { getByText } = render(<Badge tone="primary">Primary</Badge>);
    const el = getByText("Primary");
    expect(el.className).toContain("mdt-color-primary-soft");
    expect(el.className).toContain("text-mdt-text");
  });

  it("uses semantic status soft tokens", () => {
    const { getByText, rerender } = render(<Badge tone="success">Success</Badge>);
    expect(getByText("Success").className).toContain("mdt-color-success-soft");

    rerender(<Badge tone="warning">Warning</Badge>);
    expect(getByText("Warning").className).toContain("mdt-color-warning-soft");

    rerender(<Badge tone="danger">Danger</Badge>);
    expect(getByText("Danger").className).toContain("mdt-color-danger-soft");

    rerender(<Badge tone="info">Info</Badge>);
    expect(getByText("Info").className).toContain("mdt-color-info-soft");
  });
});
