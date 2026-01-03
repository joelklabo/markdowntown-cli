import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    artifact: { findMany: vi.fn() },
  },
  hasDatabaseEnv: true,
}));

import { prisma } from "@/lib/prisma";
import { listPublicItems } from "@/lib/publicItems";

describe("listPublicItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const now = new Date();
    (prisma.artifact.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "s1",
        slug: "s1",
        type: "MODULE",
        title: "Snippet One",
        description: "Hello",
        tags: ["System Prompt"],
        targets: ["agents-md"],
        hasScopes: true,
        lintGrade: "A",
        views: 10,
        copies: 2,
        votesUp: 3,
        createdAt: now,
        updatedAt: now,
        versions: [
          {
            uam: {
              schemaVersion: 1,
              meta: { title: "Test" },
              scopes: [
                { id: "global", kind: "global" },
                { id: "src", kind: "dir", dir: "src" },
              ],
              blocks: [
                { id: "b1", scopeId: "global", kind: "markdown", body: "Hello" },
                { id: "b2", scopeId: "global", kind: "markdown", body: "World" },
                { id: "b3", scopeId: "src", kind: "markdown", body: "!" },
              ],
            },
          },
        ],
      },
      {
        id: "t1",
        slug: "t1",
        type: "TEMPLATE",
        title: "Template",
        description: "Describe",
        tags: ["style"],
        targets: ["agents-md", "github-copilot"],
        hasScopes: false,
        lintGrade: null,
        views: 5,
        copies: 4,
        votesUp: 0,
        createdAt: now,
        updatedAt: now,
        versions: [
          {
            uam: {
              schemaVersion: 1,
              meta: { title: "Template" },
              scopes: [{ id: "global", kind: "global" }],
              blocks: [{ id: "b1", scopeId: "global", kind: "markdown", body: "Do it." }],
            },
          },
        ],
      },
      {
        id: "a1",
        slug: "a1",
        type: "ARTIFACT",
        title: "Agent",
        description: "Agent desc",
        tags: ["file"],
        targets: [],
        hasScopes: false,
        lintGrade: "C",
        views: 8,
        copies: 9,
        votesUp: 2,
        createdAt: now,
        updatedAt: now,
        versions: [],
      },
    ]);
  });

  it("merges types and normalizes tags", async () => {
    const items = await listPublicItems({ limit: 10 });
    const tags = items.flatMap((i) => i.tags);
    expect(tags).toContain("system-prompt");
    expect(tags).toContain("style");
    expect(items.map((i) => i.type)).toEqual(expect.arrayContaining(["snippet", "template", "agent"]));
    const snippet = items.find((i) => i.id === "s1")!;
    expect(snippet.targets).toEqual(["agents-md"]);
    expect(snippet.hasScopes).toBe(true);
    expect(snippet.lintGrade).toBe("A");
    expect(snippet.scopeCount).toBe(2);
    expect(snippet.blockCount).toBe(3);
  });

  it("builds filters for type, targets, hasScopes, tags, search, sort", async () => {
    await listPublicItems({
      limit: 120,
      sort: "views",
      type: "template",
      search: "hello",
      tags: ["System Prompt"],
      targets: ["agents-md", "github-copilot"],
      hasScopes: true,
    });

    expect(prisma.artifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        orderBy: { views: "desc" },
        where: expect.objectContaining({
          visibility: "PUBLIC",
          type: "TEMPLATE",
          tags: { hasSome: ["system-prompt"] },
          targets: { hasSome: ["agents-md", "github-copilot"] },
          hasScopes: true,
          OR: [
            { title: { contains: "hello", mode: "insensitive" } },
            { description: { contains: "hello", mode: "insensitive" } },
          ],
        }),
      })
    );
  });
});
