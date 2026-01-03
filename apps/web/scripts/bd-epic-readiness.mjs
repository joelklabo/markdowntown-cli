export function computeEpicStatusUpdates(
  issues,
  {
    epicStatusesToBlock = ["open", "in_progress"],
    childStatusesThatBlock = ["open", "in_progress", "blocked"],
    parentChildDependencyType = "parent-child",
    blockedStatus = "blocked",
  } = {},
) {
  const epicStatuses = new Set(epicStatusesToBlock);
  const childBlockingStatuses = new Set(childStatusesThatBlock);

  /** @type {Map<string, unknown>} */
  const issuesById = new Map();
  /** @type {Map<string, string[]>} */
  const childIdsByParentId = new Map();

  for (const issue of issues) {
    if (!issue?.id) continue;
    issuesById.set(issue.id, issue);

    for (const dep of issue.dependencies ?? []) {
      if (dep?.type !== parentChildDependencyType) continue;
      const parentId = dep.depends_on_id;
      if (!parentId) continue;
      const list = childIdsByParentId.get(parentId);
      if (list) {
        list.push(issue.id);
      } else {
        childIdsByParentId.set(parentId, [issue.id]);
      }
    }
  }

  /** @type {Array<{id: string, from: string, to: string, openChildren: string[]}>} */
  const updates = [];

  for (const issue of issues) {
    if (!issue?.id || issue.issue_type !== "epic") continue;
    if (!epicStatuses.has(issue.status)) continue;

    const childIds = childIdsByParentId.get(issue.id) ?? [];
    if (childIds.length === 0) continue;

    const openChildren = childIds.filter((childId) => {
      const child = issuesById.get(childId);
      const status = child?.status;
      return typeof status === "string" && childBlockingStatuses.has(status);
    });

    if (openChildren.length === 0) continue;

    updates.push({
      id: issue.id,
      from: issue.status,
      to: blockedStatus,
      openChildren,
    });
  }

  return updates;
}

