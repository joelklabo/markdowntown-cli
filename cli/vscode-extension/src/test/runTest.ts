import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  // Suppress punycode deprecation warning from transitive dependencies
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
  let fakeHome = "";
  let logFile = "";

  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const repoRoot = path.resolve(extensionDevelopmentPath, "..");

    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "markdowntown-lsp-test-")
    );
    fakeHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "markdowntown-home-")
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

    // Each file should map to a unique tool to avoid MD001 conflicts
    // AGENTS.md → github-copilot, github-copilot-cli, codex
    const testFile = path.join(workspaceDir, "AGENTS.md");
    fs.writeFileSync(testFile, "# Test\n");

    // GEMINI.md → gemini (no conflict with AGENTS.md)
    const frontmatterFile = path.join(workspaceDir, "GEMINI.md");
    fs.writeFileSync(frontmatterFile, "---\nkey: value\n---\n");

    // CLAUDE.md → claude (no conflict with AGENTS.md or GEMINI.md)
    // Use for empty file tests
    const emptyFile = path.join(workspaceDir, "CLAUDE.md");
    fs.writeFileSync(emptyFile, "");

    // For gitignored test, use .cursor/rules/test.md (cursor tool, no conflict)
    const cursorRulesDir = path.join(workspaceDir, ".cursor", "rules");
    fs.mkdirSync(cursorRulesDir, { recursive: true });
    const gitignoredFile = path.join(cursorRulesDir, "test.md");
    fs.writeFileSync(gitignoredFile, "# Ignored\n");
    fs.writeFileSync(path.join(workspaceDir, ".gitignore"), ".cursor/rules/test.md\n");

    // MD005 Setup: User config exists, but no repo config for the same tool.
    // Use Cline which has user config at ~/Documents/Cline/Rules but we won't create .clinerules
    const userClineDir = path.join(fakeHome, "Documents", "Cline", "Rules");
    fs.mkdirSync(userClineDir, { recursive: true });
    const userFile = path.join(userClineDir, "test-rule.md");
    fs.writeFileSync(userFile, "# User Instructions\n");

    // MD007 Setup: Multiple skill configs with same name.
    const skill1Dir = path.join(workspaceDir, ".codex", "skills", "one");
    const skill2Dir = path.join(workspaceDir, ".codex", "skills", "two");
    fs.mkdirSync(skill1Dir, { recursive: true });
    fs.mkdirSync(skill2Dir, { recursive: true });
    const duplicateSkillFile = path.join(skill1Dir, "SKILL.md");
    const duplicateSkillFile2 = path.join(skill2Dir, "SKILL.md");
    fs.writeFileSync(duplicateSkillFile, "---\nname: shared\n---\n# Skill 1\n");
    fs.writeFileSync(duplicateSkillFile2, "---\nname: shared\n---\n# Skill 2\n");

    logFile = path.join(workspaceDir, "test.log");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspaceDir, "--disable-extensions"],
      extensionTestsEnv: {
        HOME: fakeHome,
        USERPROFILE: fakeHome, // Windows
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
