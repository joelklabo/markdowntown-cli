import { describe, expect, it } from "vitest";
import { redactAnalyticsPayload } from "@/lib/analytics";

describe("redactAnalyticsPayload", () => {
  it("removes sensitive keys and preserves safe fields", () => {
    const input = {
      content: "secret",
      paths: ["a/one", "b/two"],
      files: ["AGENTS.md"],
      cwd: "projects/secret-repo",
      rootName: "secret-repo",
      path: "/atlas/simulator",
      fileCount: 2,
      filename: "AGENTS.md",
      repo: "secret-repo",
      repository: "secret-repo",
      absolute_path: "/Users/name/secret-repo/AGENTS.md",
      url: "file:///Users/name/secret-repo/AGENTS.md",
      nested: {
        contents: "nested",
        scannedPaths: ["x"],
        filename: "nested.md",
        keep: "ok",
      },
    };

    const result = redactAnalyticsPayload(input);

    expect(result).toEqual({
      path: "/atlas/simulator",
      fileCount: 2,
      nested: {
        keep: "ok",
      },
    });
    expect(input).toEqual({
      content: "secret",
      paths: ["a/one", "b/two"],
      files: ["AGENTS.md"],
      cwd: "projects/secret-repo",
      rootName: "secret-repo",
      path: "/atlas/simulator",
      fileCount: 2,
      filename: "AGENTS.md",
      repo: "secret-repo",
      repository: "secret-repo",
      absolute_path: "/Users/name/secret-repo/AGENTS.md",
      url: "file:///Users/name/secret-repo/AGENTS.md",
      nested: {
        contents: "nested",
        scannedPaths: ["x"],
        filename: "nested.md",
        keep: "ok",
      },
    });
  });

  it("redacts nested arrays of objects", () => {
    const input = {
      items: [
        { name: "one", paths: ["a"] },
        { name: "two", content: "secret" },
      ],
    };

    expect(redactAnalyticsPayload(input)).toEqual({
      items: [{ name: "one" }, { name: "two" }],
    });
  });

  it("redacts scan payloads while preserving counters", () => {
    const input = {
      method: "directory_picker",
      tool: "codex",
      cwd: "/Users/name/secret-repo",
      errorName: "SecurityError",
      totalFiles: 120,
      matchedFiles: 42,
      truncated: false,
      rootName: "secret-repo",
      scannedPaths: ["src/index.ts"],
    };

    expect(redactAnalyticsPayload(input)).toEqual({
      method: "directory_picker",
      tool: "codex",
      errorName: "SecurityError",
      totalFiles: 120,
      matchedFiles: 42,
      truncated: false,
    });
  });

  it("redacts open-workbench next-step payloads", () => {
    const input = {
      actionId: "open-workbench",
      stepId: "ready",
      tool: "github-copilot",
      repoSource: "scan",
      cwd: "/Users/name/secret-repo",
      paths: ["AGENTS.md", ".github/copilot-instructions.md"],
      fileCount: 2,
      isStale: false,
    };

    expect(redactAnalyticsPayload(input)).toEqual({
      actionId: "open-workbench",
      stepId: "ready",
      tool: "github-copilot",
      repoSource: "scan",
      fileCount: 2,
      isStale: false,
    });
  });

  it("preserves session timing fields", () => {
    const input = {
      entrySource: "scan",
      time_to_open_workbench_ms: 1200,
      time_to_export_ms: 5600,
    };

    expect(redactAnalyticsPayload(input)).toEqual(input);
  });

  it("preserves home CTA payload fields", () => {
    const input = {
      cta: "scan",
      href: "/atlas/simulator",
      placement: "hero",
      slot: "primary",
    };

    expect(redactAnalyticsPayload(input)).toEqual(input);
  });

  it("redacts translate payloads without leaking content", () => {
    const input = {
      targetIds: ["claude-code", "codex"],
      targetCount: 2,
      inputChars: 420,
      detectedLabel: "Markdown",
      content: "secret",
      files: ["AGENTS.md"],
    };

    expect(redactAnalyticsPayload(input)).toEqual({
      targetIds: ["claude-code", "codex"],
      targetCount: 2,
      inputChars: 420,
      detectedLabel: "Markdown",
    });
  });

  it("redacts translate download payloads without leaking content", () => {
    const input = {
      targetIds: ["claude-code", "codex"],
      targetCount: 2,
      fileCount: 4,
      byteSize: 2048,
      files: ["AGENTS.md"],
      content: "secret",
    };

    expect(redactAnalyticsPayload(input)).toEqual({
      targetIds: ["claude-code", "codex"],
      targetCount: 2,
      fileCount: 4,
      byteSize: 2048,
    });
  });

  it("redacts library action payloads without leaking content", () => {
    const input = {
      action: "open_workbench",
      id: "artifact-1",
      title: "My Template",
      source: "library_card",
      content: "secret",
      paths: ["private/path"],
    };

    expect(redactAnalyticsPayload(input)).toEqual({
      action: "open_workbench",
      id: "artifact-1",
      title: "My Template",
      source: "library_card",
    });
  });

  it("returns undefined when given undefined", () => {
    expect(redactAnalyticsPayload(undefined)).toBeUndefined();
  });
});
