import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/prisma", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prisma")>("@/lib/prisma");
  return { ...actual, hasDatabaseEnv: true };
});
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listTopTags } from "@/lib/publicTags";

describe("publicTags query", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses interval-day filter compatible with Postgres 15", async () => {
    const query = vi.spyOn(prisma, "$queryRaw").mockResolvedValue([]);

    await listTopTags(10, 7);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = query.mock.calls[0];
    const fragment = sql as Prisma.Sql;
    expect(fragment.sql).toContain('FROM "Artifact"');
    expect(fragment.sql).not.toContain('FROM "Snippet"');
    expect(fragment.sql).not.toContain('FROM "Template"');
    expect(fragment.sql).not.toContain('FROM "Document"');
    expect(fragment.sql).toContain("INTERVAL '1 day'");
    expect(fragment.sql).not.toContain("make_interval");
    expect(fragment.values).toContain(7);
  });
});
