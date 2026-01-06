import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  // Suppress punycode deprecation warning from transitive dependencies
  // The warning comes from VS Code's Electron dependencies and cannot be easily fixed
  // by updating our direct dependencies. This is a known issue across VS Code extensions.
  // See: https://github.com/nodejs/node/issues/47228
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = (warning, ...args: any[]) => {
    if (
      typeof warning === "string" &&
      warning.includes("punycode")
    ) {
      return;
    }
    if (
      typeof warning === "object" &&
      warning.name === "DeprecationWarning" &&
      warning.message.includes("punycode")
    ) {
      return;
    }
    return originalEmitWarning.call(process, warning, ...args);
  };

  let workspaceDir = "";
  let logFile = "";

  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const repoRoot = path.resolve(extensionDevelopmentPath, "..");

    workspaceDir = fs.mkdtempSync(
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

    const frontmatterFile = path.join(workspaceDir, "frontmatter.md");
    fs.writeFileSync(frontmatterFile, "---\nkey: value\n---\n");

    const emptyFile = path.join(workspaceDir, "empty.md");
    fs.writeFileSync(emptyFile, "");

    const gitignoredFile = path.join(workspaceDir, "ignored.md");
    fs.writeFileSync(gitignoredFile, "# Ignored\n");
    fs.writeFileSync(path.join(workspaceDir, ".gitignore"), "ignored.md\n");

    const userFile = path.join(workspaceDir, "user.md");
    fs.writeFileSync(userFile, "# User\n");

    const duplicateSkillFile = path.join(workspaceDir, "duplicate.md");
    fs.writeFileSync(duplicateSkillFile, "---\nskill: a\nskill: b\n---\n");

    logFile = path.join(workspaceDir, "test.log");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspaceDir, "--disable-extensions"],
      extensionTestsEnv: {
        MARKDOWNTOWN_TEST_WORKSPACE: workspaceDir,
        MARKDOWNTOWN_TEST_FILE: testFile,
        MARKDOWNTOWN_TEST_FRONTMATTER_FILE: frontmatterFile,
        MARKDOWNTOWN_TEST_EMPTY_FILE: emptyFile,
        MARKDOWNTOWN_TEST_GITIGNORED_FILE: gitignoredFile,
        MARKDOWNTOWN_TEST_USER_FILE: userFile,
        MARKDOWNTOWN_TEST_DUPLICATE_SKILL_FILE: duplicateSkillFile,
        MARKDOWNTOWN_REGISTRY: path.join(repoRoot, "data", "ai-config-patterns.json"),
        MARKDOWNTOWN_TEST_LOG: logFile,
      },
    });
  } catch (err) {
    console.error("Failed to run VS Code extension tests.", err);
    if (logFile && fs.existsSync(logFile)) {
      console.log("--- TEST LOG START ---");
      console.log(fs.readFileSync(logFile, "utf8"));
      console.log("--- TEST LOG END ---");
    }
    process.exit(1);
  }
}

void main();