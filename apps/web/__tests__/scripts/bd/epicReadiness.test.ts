import { describe, expect, it } from "vitest";
import { computeEpicStatusUpdates } from "../../../scripts/bd-epic-readiness.mjs";

describe("computeEpicStatusUpdates", () => {
  it("blocks open epics that have open child issues", () => {
    const issues = [
      { id: "e1", issue_type: "epic", status: "open" },
      {
        id: "t1",
        issue_type: "task",
        status: "open",
        dependencies: [{ issue_id: "t1", depends_on_id: "e1", type: "parent-child" }],
      },
      {
        id: "t2",
        issue_type: "task",
        status: "closed",
        dependencies: [{ issue_id: "t2", depends_on_id: "e1", type: "parent-child" }],
      },
    ];

    expect(computeEpicStatusUpdates(issues)).toEqual([
      { id: "e1", from: "open", to: "blocked", openChildren: ["t1"] },
    ]);
  });

  it("does not block epics when all children are closed", () => {
    const issues = [
      { id: "e1", issue_type: "epic", status: "open" },
      {
        id: "t1",
        issue_type: "task",
        status: "closed",
        dependencies: [{ issue_id: "t1", depends_on_id: "e1", type: "parent-child" }],
      },
    ];

    expect(computeEpicStatusUpdates(issues)).toEqual([]);
  });

  it("does not block closed epics", () => {
    const issues = [
      { id: "e1", issue_type: "epic", status: "closed" },
      {
        id: "t1",
        issue_type: "task",
        status: "open",
        dependencies: [{ issue_id: "t1", depends_on_id: "e1", type: "parent-child" }],
      },
    ];

    expect(computeEpicStatusUpdates(issues)).toEqual([]);
  });
});

