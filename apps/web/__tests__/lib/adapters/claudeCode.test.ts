import { describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "@/lib/adapters/claudeCode";
import type { UamTargetV1 } from "@/lib/uam/uamTypes";
import { makeUam } from "./fixtures/makeUam";
import { claudeCodeFixtures } from "./fixtures/claudeCode";

describe("Claude Code v1 adapter", () => {
  for (const fixture of claudeCodeFixtures) {
    it(`fixture: ${fixture.name}`, async () => {
      const result = await claudeCodeAdapter.compile(fixture.uam, fixture.target);
      expect(result).toEqual(fixture.expected);
    });
  }

  it("emits global scope to CLAUDE.md", async () => {
    const uam = makeUam({
      scopes: [{ id: "global", kind: "global" }],
      blocks: [
        { id: "b1", scopeId: "global", kind: "markdown", body: "One" },
        { id: "b2", scopeId: "global", kind: "markdown", body: "Two" },
      ],
    });

    const result = await claudeCodeAdapter.compile(uam);

    expect(result.warnings).toHaveLength(0);
    expect(result.files.map((f) => f.path)).toEqual(["CLAUDE.md"]);
    expect(result.files[0]?.content).toContain("One");
    expect(result.files[0]?.content).toContain("Two");
  });

  it("emits scoped rules to .claude/rules/*.md", async () => {
    const uam = makeUam({
      scopes: [{ id: "s1", kind: "dir", dir: "src" }],
      blocks: [{ id: "b1", scopeId: "s1", kind: "markdown", body: "Dir rules" }],
    });

    const result = await claudeCodeAdapter.compile(uam);

    expect(result.warnings).toHaveLength(0);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe(".claude/rules/src.md");
    expect(result.files[0]?.content).toContain("Rules for src");
    expect(result.files[0]?.content).toContain("Dir rules");
  });

  it("handles rule name collisions deterministically", async () => {
    const uam = makeUam({
      scopes: [
        { id: "a", kind: "glob", name: "rules", patterns: ["src/**/*.ts"] },
        { id: "b", kind: "glob", name: "rules", patterns: ["src/**/*.tsx"] },
      ],
      blocks: [
        { id: "b1", scopeId: "a", kind: "markdown", body: "A rules" },
        { id: "b2", scopeId: "b", kind: "markdown", body: "B rules" },
      ],
    });

    const result = await claudeCodeAdapter.compile(uam);

    expect(result.files.map((f) => f.path)).toEqual([".claude/rules/rules-2.md", ".claude/rules/rules.md"]);
  });

  it("exports skills when configured", async () => {
    const uam = makeUam({
      scopes: [{ id: "global", kind: "global" }],
      blocks: [{ id: "b1", scopeId: "global", kind: "markdown", body: "Global rules" }],
      capabilities: [
        { id: "review", title: "Review", description: "Review changes carefully", params: { level: "strict" } },
      ],
    });

    const target: UamTargetV1 = { targetId: "claude-code", adapterVersion: "1", options: { exportSkills: true } };
    const result = await claudeCodeAdapter.compile(uam, target);

    expect(result.files.map((f) => f.path)).toEqual([".claude/skills/review/SKILL.md", "CLAUDE.md"]);
    const skill = result.files.find((f) => f.path.endsWith("SKILL.md"))?.content ?? "";
    expect(skill).toContain("# Review");
    expect(skill).toContain('"level": "strict"');
  });

  it("exports allowlisted skills and warns on unknown ids", async () => {
    const uam = makeUam({
      scopes: [{ id: "global", kind: "global" }],
      blocks: [{ id: "b1", scopeId: "global", kind: "markdown", body: "Global rules" }],
      capabilities: [
        { id: "review", title: "Review", description: "Review changes carefully" },
        { id: "lint", title: "Lint", description: "Run lint checks" },
      ],
    });

    const target: UamTargetV1 = {
      targetId: "claude-code",
      adapterVersion: "1",
      options: { skills: ["review", "missing"] },
    };
    const result = await claudeCodeAdapter.compile(uam, target);

    expect(result.files.map((f) => f.path)).toEqual([".claude/skills/review/SKILL.md", "CLAUDE.md"]);
    expect(result.warnings.some((warning) => warning.includes("Unknown skill capability id 'missing'"))).toBe(true);
  });
});
