import * as assert from "node:assert";
import * as vscode from "vscode";

// Messages include the YAML parser detail, so match the prefix plus rule ID.
const frontmatterErrorMessage = "Invalid YAML frontmatter";
const frontmatterRuleId = "MD003";

suite("markdowntown LSP overlay", () => {
  test("publishes diagnostics for unsaved overlay changes", async () => {
    const testFile = process.env.MARKDOWNTOWN_TEST_FILE;
    assert.ok(testFile, "MARKDOWNTOWN_TEST_FILE env var not set");

    const document = await vscode.workspace.openTextDocument(testFile);
    const editor = await vscode.window.showTextDocument(document);

    await editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(0, 0),
        "---\nkey: value\ninvalid: [\n---\n"
      );
    });

    assert.strictEqual(document.isDirty, true);

    const diagnostics = await waitForDiagnostics(
      document.uri,
      (items) =>
        items.some(
          (item) =>
            item.source === "markdowntown" &&
            item.message.startsWith(frontmatterErrorMessage) &&
            diagnosticCode(item) === frontmatterRuleId
        )
    );

    assert.ok(
      diagnostics.find(
        (item) =>
          item.source === "markdowntown" &&
          item.message.startsWith(frontmatterErrorMessage) &&
          diagnosticCode(item) === frontmatterRuleId
      )
    );
  });
});

function diagnosticCode(item: vscode.Diagnostic): string | undefined {
  if (!item.code) {
    return undefined;
  }
  if (typeof item.code === "string" || typeof item.code === "number") {
    return String(item.code);
  }
  return String(item.code.value);
}

async function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (items: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs = 10000
): Promise<readonly vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      subscription.dispose();
      reject(new Error("Timed out waiting for markdowntown diagnostics."));
    }, timeoutMs);

    const check = () => {
      const diagnostics = vscode.languages.getDiagnostics(uri);
      if (!predicate(diagnostics)) {
        return;
      }
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      subscription.dispose();
      resolve(diagnostics);
    };

    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (event.uris.some((changed) => changed.toString() == uri.toString())) {
        check();
      }
    });

    check();
  });
}
