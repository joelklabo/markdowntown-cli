import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { hasHardFailure, loadDocSnapshot, refreshDocumentation } from "@/lib/docs/refresh";

describe("docs refresh pipeline", () => {
  let tmp: string;
  let storeRoot: string;
  let registryPath: string;
  let inventoryPath: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "doc-refresh-"));
    storeRoot = path.join(tmp, "store");
    registryPath = path.join(tmp, "registry.json");
    inventoryPath = path.join(tmp, "inventory.json");

    await fs.writeFile(
      registryPath,
      JSON.stringify({
        version: "1.0",
        allowlistHosts: ["example.com"],
        sources: [
          {
            id: "docs",
            tier: "tier-0",
            client: "demo",
            url: "https://example.com/docs",
            refreshHours: 24,
          },
        ],
      }),
      "utf8",
    );

    await fs.writeFile(
      inventoryPath,
      JSON.stringify({
        version: "1.0",
        documents: [
          {
            id: "user-guide",
            title: "User Guide",
            url: "https://example.com/docs",
          },
        ],
      }),
      "utf8",
    );
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes snapshots on success", async () => {
    const result = await refreshDocumentation({
      registrySource: registryPath,
      inventorySource: inventoryPath,
      storeRoot,
    });

    expect(hasHardFailure(result)).toBe(false);

    const registry = await loadDocSnapshot("registry", storeRoot);
    expect(registry?.source).toContain("registry.json");
    expect(registry?.sha256).toBeDefined();
    expect(registry?.content).toContain("allowlistHosts");

    const inventory = await loadDocSnapshot("inventory", storeRoot);
    expect(inventory?.content).toContain("documents");
  });

  it("falls back to last good data when refresh fails", async () => {
    await refreshDocumentation({
      registrySource: registryPath,
      inventorySource: inventoryPath,
      storeRoot,
    });

    const result = await refreshDocumentation({
      registrySource: path.join(tmp, "missing.json"),
      inventorySource: inventoryPath,
      storeRoot,
    });

    const registryResult = result.items.find((item) => item.kind === "registry");
    expect(registryResult?.error).toBeDefined();
    expect(registryResult?.fallback?.content).toContain("allowlistHosts");
    expect(hasHardFailure(result)).toBe(false);
  });
});
