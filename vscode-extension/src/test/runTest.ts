import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const repoRoot = path.resolve(extensionDevelopmentPath, "..");

    const workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "markdowntown-lsp-test-")
    );

    const binDir = path.join(workspaceDir, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const binName = process.platform === "win32" ? "markdowntown.exe" : "markdowntown";
    const binPath = path.join(binDir, binName);

    execFileSync("go", ["build", "-o", binPath, "./cmd/markdowntown"], {
      cwd: repoRoot,
      stdio: "inherit",
    });

    const settingsDir = path.join(workspaceDir, ".vscode");
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, "settings.json"),
      JSON.stringify({ "markdowntown.serverPath": binPath }, null, 2)
    );

    const testFile = path.join(workspaceDir, "AGENTS.md");
    fs.writeFileSync(testFile, "# Test\n");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspaceDir, "--disable-extensions"],
      extensionTestsEnv: {
        MARKDOWNTOWN_TEST_WORKSPACE: workspaceDir,
        MARKDOWNTOWN_TEST_FILE: testFile,
        MARKDOWNTOWN_REGISTRY: path.join(repoRoot, "data", "ai-config-patterns.json"),
      },
    });
  } catch (err) {
    console.error("Failed to run VS Code extension tests.", err);
    process.exit(1);
  }
}

void main();
