import { render, screen } from "@testing-library/react";
import { BuilderStatus } from "@/components/BuilderStatus";

describe("BuilderStatus", () => {
  beforeAll(() => {
    const navEntry: Partial<PerformanceNavigationTiming> & { serverTiming?: PerformanceServerTiming[] } = {
      responseStart: 123,
      serverTiming: [{ name: "cache", duration: 0, description: "cacheable" } as PerformanceServerTiming],
    };
    // @ts-expect-error partial
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([navEntry]);
    (window as { __MDT_BUNDLE_OK?: boolean }).__MDT_BUNDLE_OK = false;
  });

  it("shows TTFB and cache intent", async () => {
    render(<BuilderStatus />);
    expect(await screen.findByText(/TTFB 123ms/)).toBeInTheDocument();
    expect(screen.getByText(/cacheable/)).toBeInTheDocument();
    expect(screen.getByText(/Bundle size warning/)).toBeInTheDocument();
  });
});
