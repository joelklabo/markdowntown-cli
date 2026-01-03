import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewDrawer } from "@/components/library/PreviewDrawer";

describe("PreviewDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("opens and renders manifest + markdown", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifact: { id: "1", slug: "test-agent", targets: ["agents-md"] },
          latestVersion: {
            version: "1",
            uam: {
              schemaVersion: 1,
              meta: { title: "Test Agent" },
              scopes: [],
              blocks: [],
              capabilities: [],
              targets: [{ targetId: "agents-md" }],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ path: "agents.md", content: "# Hello from preview" }],
          warnings: [],
          info: [],
        }),
      });

    render(<PreviewDrawer artifactId="1" title="Test Agent" targets={["agents-md"]} />);

    await userEvent.click(screen.getByRole("button", { name: /preview/i }));

    expect(await screen.findByText("Manifest")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "agents.md" })).toBeInTheDocument();
    expect(await screen.findByText("# Hello from preview")).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/artifacts/1");
    });

    const compileCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === "/api/compile");
    expect(compileCall).toBeTruthy();
    const init = compileCall?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body ?? "{}")) as { targets?: Array<{ targetId: string }> };
    expect(body.targets).toEqual([{ targetId: "agents-md" }]);
  });

  it("closes the drawer", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifact: { id: "1", slug: "test-agent", targets: ["agents-md"] },
          latestVersion: {
            version: "1",
            uam: {
              schemaVersion: 1,
              meta: { title: "Test Agent" },
              scopes: [],
              blocks: [],
              capabilities: [],
              targets: [{ targetId: "agents-md" }],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ path: "agents.md", content: "# Hello from preview" }],
          warnings: [],
          info: [],
        }),
      });

    render(<PreviewDrawer artifactId="1" title="Test Agent" targets={["agents-md"]} />);

    await userEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByText("Raw markdown");

    await userEvent.click(screen.getByText("×"));
    expect(screen.queryByText("Raw markdown")).not.toBeInTheDocument();
  });
});

