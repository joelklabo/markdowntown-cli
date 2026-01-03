import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { simulateContextResolution } from "@/lib/atlas/simulators/simulate";
import type { SimulatorToolId } from "@/lib/atlas/simulators/types";

type GoldenCase = {
  id: string;
  tool: SimulatorToolId;
  cwd: string;
  files: Array<{ path: string; content: string }>;
  expected: {
    loaded: string[];
    shadowed?: string[];
    warnings?: string[];
  };
};

type GoldenSuite = {
  id: string;
  cases: GoldenCase[];
};

function loadGoldenSuite(): GoldenSuite {
  const filePath = path.join(process.cwd(), "atlas", "examples", "repo-trees", "golden-suite.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as GoldenSuite;
}

describe("atlas/simulators/golden-fixtures", () => {
  const suite = loadGoldenSuite();

  for (const testCase of suite.cases) {
    it(`matches ${testCase.id}`, () => {
      const result = simulateContextResolution({
        tool: testCase.tool,
        cwd: testCase.cwd,
        tree: { files: testCase.files },
      });

      expect(result.loaded.map((item) => item.path)).toEqual(testCase.expected.loaded);

      const expectedShadowed = [...(testCase.expected.shadowed ?? [])].sort();
      expect(result.shadowed.map((item) => item.path).sort()).toEqual(expectedShadowed);

      const expectedWarnings = [...(testCase.expected.warnings ?? [])].sort();
      expect(result.warnings.map((warning) => warning.code).sort()).toEqual(expectedWarnings);
    });
  }
});
