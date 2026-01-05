import { prisma } from "@/lib/prisma";
import { loadEngineWasm } from "@/lib/engine/wasmLoader";
import type { Run } from "@prisma/client";
import { getBlobStore } from "@/lib/storage";
import fs from "node:fs";
import path from "node:path";

export async function runWorkspaceAuditWithWasm(userId: string, workspaceId: string): Promise<Run> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      edits: true,
      snapshot: {
        include: {
          project: true,
          files: {
            include: { blob: true },
          },
        },
      },
    },
  });

  if (!workspace || workspace.snapshot.project.userId !== userId) {
    throw new Error("Workspace not found or access denied");
  }

  const engine = await loadEngineWasm();
  
  // Load registry
  const registryPath = path.resolve(process.cwd(), "../../cli/data/ai-config-patterns.json");
  // Try fallback paths
  const registryPaths = [
    registryPath,
    path.resolve(process.cwd(), "cli/data/ai-config-patterns.json"),
    path.resolve(process.cwd(), "data/ai-config-patterns.json")
  ];
  
  let registryJson = "";
  for (const p of registryPaths) {
    if (fs.existsSync(p)) {
      registryJson = fs.readFileSync(p, "utf8");
      break;
    }
  }
  
  if (!registryJson) {
    throw new Error("Could not load pattern registry");
  }
  const registry = JSON.parse(registryJson);

  // Gather files
  const files = await Promise.all(
    workspace.snapshot.files.map(async (file) => {
      const edit = workspace.edits.find((e) => e.path === file.path);
      let content = "";
      if (edit) {
        content = edit.content;
      } else if (!file.isBinary && !file.isDeleted) {
        const store = getBlobStore();
        const blob = await store.getBlob(file.blob.sha256);
        content = blob ? blob.toString("utf8") : "";
      }

      return {
        path: file.path,
        content,
      };
    })
  );

  // Filter out files without content (binary or deleted)
  const activeFiles = files.filter(f => f.content !== "");

  const result = engine.runScanAudit({
    files: activeFiles,
    registry,
    includeContent: false,
  });

  if (!result.ok) {
    throw new Error(result.error || "WASM execution failed");
  }

  // Create Run record
  const run = await prisma.run.create({
    data: {
      snapshotId: workspace.snapshotId,
      workspaceId: workspace.id,
      type: "AUDIT",
      status: "SUCCESS",
      output: result.output as unknown as import("@prisma/client").Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  });

  return run;
}