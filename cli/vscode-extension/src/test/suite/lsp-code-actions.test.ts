import * as assert from "node:assert";
import * as vscode from "vscode";

import {
  activateExtension,
  diagnosticCode,
  ensureEditorReady,
  getQuickFixTitles,
  logTest,
  openDocument,
  waitForDiagnostics,
  waitForWorkspace,
} from "./helpers";

const quickFixRemoveFrontmatter = "Remove invalid frontmatter block";
const quickFixInsertPlaceholder = "Insert placeholder instructions";
const quickFixAllowGitignore = "Allow this config in .gitignore";
const quickFixCreateRepoPrefix = "Create repo config at ";
const quickFixRemoveDuplicateFrontmatterPrefix = "Remove duplicate frontmatter ";

suite("markdowntown LSP quick fixes", () => {
  suiteSetup(async () => {
    await waitForWorkspace();
    await activateExtension();
    await ensureEditorReady();
  });

  test("offers quick fix for invalid frontmatter", async () => {
    logTest("[code-actions] frontmatter start");
    const testFile = process.env.MARKDOWNTOWN_TEST_FRONTMATTER_FILE;
    assert.ok(testFile, "MARKDOWNTOWN_TEST_FRONTMATTER_FILE env var not set");
    logTest(`[code-actions] frontmatter file ${testFile}`);

    const uri = vscode.Uri.file(testFile);
    const document = await openDocument(uri);
    logTest(`[code-actions] frontmatter language ${document.languageId}`);
    logTest("[code-actions] frontmatter opened");
    const editor = await vscode.window.showTextDocument(document);
    logTest("[code-actions] frontmatter shown");

    await editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(0, 0),
        "---\nkey: value\ninvalid: [\n---\n"
      );
    });
    await document.save();
    logTest("[code-actions] frontmatter after edit");

    const diagnostics = await waitForDiagnostics(document.uri, (items) =>
      items.some((item) => diagnosticCode(item) === "MD003")
    );
    const target = diagnostics.find(
      (item) => diagnosticCode(item) === "MD003"
    );
    const range =
      target?.range ??
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    const titles = await getQuickFixTitles(document.uri, range);

    assert.ok(
      titles.includes(quickFixRemoveFrontmatter),
      `expected quick fix ${quickFixRemoveFrontmatter}, got ${titles.join(", ")}`
    );
    logTest("[code-actions] frontmatter done");
  });

  test("offers quick fix for empty config", async () => {
    logTest("[code-actions] empty start");
    const testFile = process.env.MARKDOWNTOWN_TEST_EMPTY_FILE;
    assert.ok(testFile, "MARKDOWNTOWN_TEST_EMPTY_FILE env var not set");

    const document = await openDocument(vscode.Uri.file(testFile));
    logTest(`[code-actions] empty language ${document.languageId}`);
    const editor = await vscode.window.showTextDocument(document);

    await editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(document.lineCount, 0), "\n");
    });
    await document.save();
    logTest("[code-actions] empty after edit");

    const diagnostics = await waitForDiagnostics(document.uri, (items) =>
      items.some((item) => diagnosticCode(item) === "MD004")
    );
    const target = diagnostics.find(
      (item) => diagnosticCode(item) === "MD004"
    );
    const range =
      target?.range ??
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    const titles = await getQuickFixTitles(document.uri, range);

    assert.ok(
      titles.includes(quickFixInsertPlaceholder),
      `expected quick fix ${quickFixInsertPlaceholder}, got ${titles.join(", ")}`
    );
    logTest("[code-actions] empty done");
  });

  test("offers quick fix for gitignored config", async () => {
    logTest("[code-actions] gitignored start");
    const testFile = process.env.MARKDOWNTOWN_TEST_GITIGNORED_FILE;
    assert.ok(testFile, "MARKDOWNTOWN_TEST_GITIGNORED_FILE env var not set");

    const document = await openDocument(vscode.Uri.file(testFile));
    logTest(`[code-actions] gitignored language ${document.languageId}`);
    await vscode.window.showTextDocument(document);

    const diagnostics = await waitForDiagnostics(document.uri, (items) =>
      items.some((item) => diagnosticCode(item) === "MD002")
    );
    const target = diagnostics.find(
      (item) => diagnosticCode(item) === "MD002"
    );
    const range =
      target?.range ??
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
    logTest("[code-actions] gitignored after diagnostics");

    const titles = await getQuickFixTitles(document.uri, range);

    assert.ok(
      titles.includes(quickFixAllowGitignore),
      `expected quick fix ${quickFixAllowGitignore}, got ${titles.join(", ")}`
    );
    logTest("[code-actions] gitignored done");
  });

  test("offers quick fix for missing repo config", async () => {
    logTest("[code-actions] missing-repo start");
    const testFile = process.env.MARKDOWNTOWN_TEST_USER_FILE;
    assert.ok(testFile, "MARKDOWNTOWN_TEST_USER_FILE env var not set");

    const document = await openDocument(vscode.Uri.file(testFile));
    logTest(`[code-actions] missing-repo language ${document.languageId}`);
    await vscode.window.showTextDocument(document);
    logTest("[code-actions] missing-repo after open");

    const diagnostics = await waitForDiagnostics(document.uri, (items) =>
      items.some((item) => diagnosticCode(item) === "MD005")
    );
    const target = diagnostics.find(
      (item) => diagnosticCode(item) === "MD005"
    );
    const range =
      target?.range ??
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    const titles = await getQuickFixTitles(document.uri, range);

    assert.ok(
      titles.some((title) => title.startsWith(quickFixCreateRepoPrefix)),
      `expected quick fix starting with ${quickFixCreateRepoPrefix}, got ${titles.join(", ")}`
    );
    logTest("[code-actions] missing-repo done");
  });

  test("offers quick fix for duplicate frontmatter", async () => {
    logTest("[code-actions] duplicate-frontmatter start");
    const testFile = process.env.MARKDOWNTOWN_TEST_DUPLICATE_SKILL_FILE;
    assert.ok(
      testFile,
      "MARKDOWNTOWN_TEST_DUPLICATE_SKILL_FILE env var not set"
    );

    const document = await openDocument(vscode.Uri.file(testFile));
    logTest(`[code-actions] duplicate-frontmatter language ${document.languageId}`);
    await vscode.window.showTextDocument(document);
    logTest("[code-actions] duplicate-frontmatter after open");

    const diagnostics = await waitForDiagnostics(document.uri, (items) =>
      items.some((item) => diagnosticCode(item) === "MD007")
    );
    const target = diagnostics.find(
      (item) => diagnosticCode(item) === "MD007"
    );
    const range =
      target?.range ??
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    const titles = await getQuickFixTitles(document.uri, range);

    assert.ok(
      titles.some((title) =>
        title.startsWith(quickFixRemoveDuplicateFrontmatterPrefix)
      ),
      `expected quick fix starting with ${quickFixRemoveDuplicateFrontmatterPrefix}, got ${titles.join(", ")}`
    );
    logTest("[code-actions] duplicate-frontmatter done");
  });
});
