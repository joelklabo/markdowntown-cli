import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DiffPanel } from "@/components/workbench/DiffPanel";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

describe("DiffPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
    });
  });

  it("shows an empty state when no baseline exists", () => {
    render(<DiffPanel />);
    expect(screen.getByText(/no baseline/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no changes", () => {
    act(() => {
      const store = useWorkbenchStore.getState();
      useWorkbenchStore.setState({ baselineUam: store.uam });
    });

    render(<DiffPanel />);
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it("renders a unified diff when the draft changes", () => {
    act(() => {
      const store = useWorkbenchStore.getState();
      const baseline = { ...store.uam, meta: { ...store.uam.meta, title: "Baseline" } };
      store.setUam({ ...store.uam, meta: { ...store.uam.meta, title: "Current" } });
      useWorkbenchStore.setState({ baselineUam: baseline });
    });

    render(<DiffPanel />);
    const viewer = screen.getByTestId("diff-viewer");
    expect(viewer.textContent).toContain('-    "title": "Baseline"');
    expect(viewer.textContent).toContain('+    "title": "Current",');
  });
});
