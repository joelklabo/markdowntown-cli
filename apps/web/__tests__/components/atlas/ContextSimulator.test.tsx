import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextSimulator } from "@/components/atlas/ContextSimulator";
import { SCAN_TREE_VIRTUALIZATION_THRESHOLD } from "@/components/atlas/SimulatorScanMeta";
import { featureFlags } from "@/lib/flags";

vi.mock("@/lib/flags", () => ({
  featureFlags: {
    publicLibrary: false,
    themeRefreshV1: false,
    uxClarityV1: false,
    instructionHealthV1: true,
    scanNextStepsV1: true,
    scanQuickUploadV1: false,
    wordmarkAnimV1: true,
    wordmarkBannerV1: true,
  },
}));

type MockHandle = {
  kind: "file" | "directory";
  name: string;
  entries?: () => AsyncIterable<[string, MockHandle]>;
};

function file(name: string): MockHandle {
  return { kind: "file", name };
}

function dir(name: string, children: MockHandle[]): MockHandle {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const child of children) {
        yield [child.name, child];
      }
    },
  };
}

function restorePicker(originalPicker: unknown) {
  if (originalPicker) {
    Object.defineProperty(window, "showDirectoryPicker", {
      value: originalPicker,
      configurable: true,
    });
  } else {
    // @ts-expect-error remove the stub when not present
    delete window.showDirectoryPicker;
  }
}

describe("ContextSimulator", () => {
  beforeEach(() => {
    featureFlags.scanQuickUploadV1 = false;
  });
  it("simulates loaded files for GitHub Copilot", async () => {
    render(<ContextSimulator />);
    expect(screen.getByRole("heading", { name: "Scan setup" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Next steps" })).toBeInTheDocument();
    expect(screen.getByText(/upload a folder to get next steps/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download report" })).toBeInTheDocument();

    await userEvent.click(screen.getByText(/show advanced settings/i));
    const manualPathsInput = screen.getByPlaceholderText(/one path per line/i);
    await userEvent.clear(manualPathsInput);
    await userEvent.type(
      manualPathsInput,
      ".github/copilot-instructions.md\n.github/instructions/apps-web.instructions.md\nAGENTS.md\n"
    );

    await screen.findByText(/3 file\(s\) in the current source\./i);
    await userEvent.click(screen.getAllByRole("button", { name: "Refresh results" })[0]);

    expect(screen.getByRole("heading", { name: "Instruction health" })).toBeInTheDocument();
    expect(screen.getByText("0 errors / 1 warning")).toBeInTheDocument();
    const issuesList = screen.getByRole("list", { name: "Instruction health issues" });
    expect(within(issuesList).getByText(/instruction files for other tools/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Content lint" })).toBeInTheDocument();
    expect(screen.getByText("Enable content linting to see results")).toBeInTheDocument();

    const loadedList = await screen.findByRole("list", { name: "Loaded files" });
    expect(within(loadedList).getByText(".github/copilot-instructions.md")).toBeInTheDocument();
    expect(within(loadedList).getByText(".github/instructions/apps-web.instructions.md")).toBeInTheDocument();
    expect(within(loadedList).queryByText("AGENTS.md")).not.toBeInTheDocument();
  }, 15000);

  it("accepts tree output in manual paths", async () => {
    render(<ContextSimulator />);

    await userEvent.click(screen.getByText(/show advanced settings/i));
    const manualPathsInput = screen.getByPlaceholderText(/one path per line/i);
    await userEvent.clear(manualPathsInput);
    await userEvent.type(
      manualPathsInput,
      ".\n|-- AGENTS.md\n\\-- .github\n    \\-- copilot-instructions.md\n"
    );

    await screen.findByText(/2 file\(s\) in the current source\./i);
    await userEvent.click(screen.getAllByRole("button", { name: "Refresh results" })[0]);

    const loadedList = await screen.findByRole("list", { name: "Loaded files" });
    expect(within(loadedList).getByText(".github/copilot-instructions.md")).toBeInTheDocument();
  }, 15000);

  it("virtualizes the scan preview for large path lists", async () => {
    render(<ContextSimulator />);

    await userEvent.click(screen.getByText(/show advanced settings/i));
    const manualPathsInput = screen.getByPlaceholderText(/one path per line/i);
    const largeList = Array.from(
      { length: SCAN_TREE_VIRTUALIZATION_THRESHOLD + 1 },
      (_, index) => `docs/file-${index}.md`,
    ).join("\n");
    fireEvent.change(manualPathsInput, { target: { value: largeList } });

    expect(await screen.findByTestId("virtualized-file-tree")).toBeInTheDocument();
  }, 15000);

  it("shows line-level errors for malformed tree input", async () => {
    render(<ContextSimulator />);

    await userEvent.click(screen.getByText(/show advanced settings/i));
    const manualPathsInput = screen.getByPlaceholderText(/one path per line/i);
    await userEvent.clear(manualPathsInput);
    await userEvent.type(manualPathsInput, ".\n|-- AGENTS.md\nNOT_A_TREE_LINE\n");

    expect(await screen.findByText(/fix these lines/i)).toBeInTheDocument();
    const errorList = screen.getByRole("list", { name: "Repo path parse errors" });
    expect(within(errorList).getByText(/line 3/i)).toBeInTheDocument();
  }, 15000);

  it("simulates loaded files for Copilot CLI", async () => {
    render(<ContextSimulator />);

    await userEvent.click(screen.getByText(/show advanced settings/i));
    await userEvent.selectOptions(screen.getByLabelText("Tool"), "copilot-cli");

    const manualPathsInput = screen.getByPlaceholderText(/one path per line/i);
    await userEvent.clear(manualPathsInput);
    await userEvent.type(
      manualPathsInput,
      ".github/copilot-instructions.md\n.github/copilot-instructions/apps-web.instructions.md\n.github/agents/release.agent.md\nAGENTS.md\n"
    );

    await screen.findByText(/4 file\(s\) in the current source\./i);
    await userEvent.click(screen.getAllByRole("button", { name: "Refresh results" })[0]);

    const loadedList = await screen.findByRole("list", { name: "Loaded files" });
    expect(within(loadedList).getByText(".github/copilot-instructions.md")).toBeInTheDocument();
    expect(within(loadedList).getByText(".github/copilot-instructions/apps-web.instructions.md")).toBeInTheDocument();
    expect(within(loadedList).getByText(".github/agents/release.agent.md")).toBeInTheDocument();
    expect(within(loadedList).queryByText("AGENTS.md")).not.toBeInTheDocument();
  }, 15000);

  it("simulates ordered loaded files for Codex CLI with cwd ancestry", async () => {
    render(<ContextSimulator />);

    await userEvent.click(screen.getByText(/show advanced settings/i));
    await userEvent.selectOptions(screen.getByLabelText("Tool"), "codex-cli");
    await userEvent.clear(screen.getByLabelText("Current directory (cwd)"));
    await userEvent.type(screen.getByLabelText("Current directory (cwd)"), "packages/app");

    const manualPathsInput = screen.getByPlaceholderText(/one path per line/i);
    await userEvent.clear(manualPathsInput);
    await userEvent.type(
      manualPathsInput,
      "AGENTS.md\nAGENTS.override.md\npackages/app/AGENTS.md\n"
    );

    await userEvent.click(screen.getAllByRole("button", { name: "Refresh results" })[0]);

    const loadedList = screen.getByRole("list", { name: "Loaded files" });
    const items = within(loadedList).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("AGENTS.md"),
      expect.stringContaining("AGENTS.override.md"),
      expect.stringContaining("packages/app/AGENTS.md"),
    ]);
  });

  it("supports folder scans and shows scan metadata + insights", async () => {
    const rootHandle = dir("repo", [file("AGENTS.md"), dir("apps", [dir("web", [file("AGENTS.md")])])]);
    const originalPicker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;

    Object.defineProperty(window, "showDirectoryPicker", {
      value: async () => rootHandle,
      configurable: true,
    });

    render(<ContextSimulator />);

    await userEvent.click(screen.getByText(/show advanced settings/i));
    await userEvent.selectOptions(screen.getByLabelText("Tool"), "codex-cli");
    await userEvent.clear(screen.getByLabelText("Current directory (cwd)"));
    await userEvent.type(screen.getByLabelText("Current directory (cwd)"), "apps/web");
    await userEvent.click(screen.getAllByRole("button", { name: "Scan a folder" })[0]);

    expect(await screen.findByText(/2 instruction files found.*2 total files scanned/i)).toBeInTheDocument();
    expect(await screen.findByText(/you're ready to go/i)).toBeInTheDocument();

    const loadedList = await screen.findByRole("list", { name: "Loaded files" });
    expect(within(loadedList).getByText("AGENTS.md")).toBeInTheDocument();
    expect(within(loadedList).getByText("apps/web/AGENTS.md")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
    expect(screen.getByText("Missing instruction files")).toBeInTheDocument();
    expect(screen.getAllByText("AGENTS.override.md").length).toBeGreaterThan(0);

    restorePicker(originalPicker);
  });

  it("shows scanning progress while a scan is in flight", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delayedHandle: MockHandle = {
      kind: "directory",
      name: "repo",
      async *entries() {
        await gate;
        const child = file("AGENTS.md");
        yield [child.name, child];
      },
    };
    const originalPicker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;

    Object.defineProperty(window, "showDirectoryPicker", {
      value: async () => delayedHandle,
      configurable: true,
    });

    render(<ContextSimulator />);

    await userEvent.click(screen.getAllByRole("button", { name: "Scan a folder" })[0]);
    expect(screen.getAllByText("Scanning…").length).toBeGreaterThan(0);

    release?.();
    expect(await screen.findByText(/1 instruction file found.*1 total file scanned/i)).toBeInTheDocument();

    restorePicker(originalPicker);
  });

  it("guards against duplicate directory picker opens", async () => {
    let resolvePicker: ((value: MockHandle) => void) | undefined;
    const pickerPromise = new Promise<MockHandle>((resolve) => {
      resolvePicker = resolve;
    });
    const rootHandle = dir("repo", [file("AGENTS.md")]);
    const originalPicker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;
    const picker = vi.fn().mockReturnValue(pickerPromise);

    Object.defineProperty(window, "showDirectoryPicker", {
      value: picker,
      configurable: true,
    });

    render(<ContextSimulator />);

    const button = screen.getAllByRole("button", { name: "Scan a folder" })[0];
    await userEvent.click(button);
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(picker).toHaveBeenCalledTimes(1);

    resolvePicker?.(rootHandle);

    expect(await screen.findByText(/1 instruction file found.*1 total file scanned/i)).toBeInTheDocument();

    restorePicker(originalPicker);
  });

  it("auto-detects tool and cwd after quick upload scan", async () => {
    featureFlags.scanQuickUploadV1 = true;
    const rootHandle = dir("repo", [file("AGENTS.md"), dir("apps", [dir("web", [file("AGENTS.md")])])]);
    const originalPicker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;

    Object.defineProperty(window, "showDirectoryPicker", {
      value: async () => rootHandle,
      configurable: true,
    });

    render(<ContextSimulator />);

    await userEvent.click(screen.getAllByRole("button", { name: "Scan a folder" })[0]);

    expect(await screen.findByText(/Detected: Codex CLI/i)).toBeInTheDocument();

    const loadedList = await screen.findByRole("list", { name: "Loaded files" });
    expect(within(loadedList).getByText("apps/web/AGENTS.md")).toBeInTheDocument();

    await userEvent.click(screen.getByText(/show advanced/i));
    expect(screen.getByLabelText("Tool")).toHaveValue("codex-cli");
    expect(screen.getByLabelText("Current directory (cwd)")).toHaveValue("apps/web");

    restorePicker(originalPicker);
  });

  it("shows mixed-tool detection guidance when multiple tools match", async () => {
    featureFlags.scanQuickUploadV1 = true;
    const rootHandle = dir("repo", [file("AGENTS.md"), file("CLAUDE.md")]);
    const originalPicker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;

    Object.defineProperty(window, "showDirectoryPicker", {
      value: async () => rootHandle,
      configurable: true,
    });

    render(<ContextSimulator />);

    await userEvent.click(screen.getAllByRole("button", { name: "Scan a folder" })[0]);

    const mixedToolNotices = await screen.findAllByText(/multiple tool formats detected/i);
    expect(mixedToolNotices.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Change tool" })).toBeInTheDocument();

    restorePicker(originalPicker);
  });

  it("surfaces scan errors and allows retry", async () => {
    featureFlags.scanQuickUploadV1 = true;
    const rootHandle = dir("repo", [file("AGENTS.md")]);
    const originalPicker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker;
    const picker = vi
      .fn()
      .mockRejectedValueOnce(new Error("Access denied"))
      .mockResolvedValueOnce(rootHandle);

    Object.defineProperty(window, "showDirectoryPicker", {
      value: picker,
      configurable: true,
    });

    render(<ContextSimulator />);

    await userEvent.click(screen.getAllByRole("button", { name: "Scan a folder" })[0]);
    const scanErrorNotices = await screen.findAllByText(/unable to scan folder/i);
    expect(scanErrorNotices.length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole("button", { name: "Scan a folder" })[0]);
    expect(await screen.findByText(/Detected: Codex CLI/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/unable to scan folder/i)).toHaveLength(0);

    restorePicker(originalPicker);
  });
});
