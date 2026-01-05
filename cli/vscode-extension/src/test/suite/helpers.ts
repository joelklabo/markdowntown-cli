import * as vscode from "vscode";
import * as fs from "node:fs";
import * as assert from "node:assert";

const testLogPath = process.env.MARKDOWNTOWN_TEST_LOG;

export function logTest(message: string): void {
  if (!testLogPath) {
    return;
  }
  fs.appendFileSync(testLogPath, `${message}\n`);
}

export function assertDiagnosticMetadata(
  diagnostic: vscode.Diagnostic,
  expected: {
    codeDescription?: string;
    tags?: vscode.DiagnosticTag[];
    relatedInformation?: boolean;
  }
): void {
  if (expected.codeDescription) {
    const code = diagnostic.code;
    assert.ok(
      typeof code === "object" && code !== null && "target" in code,
      "Diagnostic code missing target (codeDescription)"
    );
    // Cast to any to access target safely or use type guard if possible
    const target = (code as { target: vscode.Uri }).target;
    assert.ok(target, "Diagnostic code target is undefined");
    assert.ok(
      target.toString().includes(expected.codeDescription),
      `Expected codeDescription to include ${expected.codeDescription}, got ${target.toString()}`
    );
  }
  if (expected.tags) {
    assert.deepStrictEqual(diagnostic.tags, expected.tags, "Diagnostic tags mismatch");
  }
  if (expected.relatedInformation) {
    assert.ok(
      diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0,
      "Diagnostic missing relatedInformation"
    );
  }
}

export async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.getExtension("markdowntown.markdowntown");
  if (!extension) {
    throw new Error("markdowntown extension not found");
  }
  if (!extension.isActive) {
    logTest("[activate] activating markdowntown extension");
    await extension.activate();
    logTest("[activate] activated markdowntown extension");
  }
}

export async function waitForWorkspace(timeoutMs = 10000): Promise<void> {
  if ((vscode.workspace.workspaceFolders ?? []).length > 0) {
    logTest(
      `[workspace] ready: ${(vscode.workspace.workspaceFolders ?? [])
        .map((folder) => folder.uri.fsPath)
        .join(", ")}`
    );
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.dispose();
      reject(new Error("Timed out waiting for workspace folders."));
    }, timeoutMs);
    const subscription = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if ((vscode.workspace.workspaceFolders ?? []).length > 0) {
        clearTimeout(timer);
        subscription.dispose();
        logTest(
          `[workspace] ready: ${(vscode.workspace.workspaceFolders ?? [])
            .map((folder) => folder.uri.fsPath)
            .join(", ")}`
        );
        resolve();
      }
    });
  });
}

export async function openDocument(
  uri: vscode.Uri,
  timeoutMs = 10000
): Promise<vscode.TextDocument> {
  logTest(`[openDocument] request ${uri.toString()}`);
  const existing = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === uri.toString()
  );
  if (existing) {
    logTest("[openDocument] already open");
    return existing;
  }

  const document = await new Promise<vscode.TextDocument>((resolve, reject) => {
    const timer = setTimeout(() => {
      logTest(
        `[openDocument] open docs: ${vscode.workspace.textDocuments
          .map((doc) => doc.uri.toString())
          .join(", ")}`
      );
      reject(new Error(`Timed out opening document: ${uri.toString()}`));
    }, timeoutMs);

    vscode.workspace.openTextDocument(uri).then(
      (doc) => {
        clearTimeout(timer);
        resolve(doc);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

  logTest("[openDocument] openTextDocument resolved");
  return document;
}

export async function ensureEditorReady(timeoutMs = 10000): Promise<void> {
  if (vscode.window.activeTextEditor) {
    logTest("[editor] active editor already available");
    return;
  }
  logTest("[editor] creating untitled document");
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: "",
  });
  await vscode.window.showTextDocument(doc);
  const startedAt = Date.now();
  while (!vscode.window.activeTextEditor) {
    if (Date.now()-startedAt > timeoutMs) {
      throw new Error("Timed out waiting for active editor.");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  logTest("[editor] active editor ready");
}

export async function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (items: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs = 20000
): Promise<readonly vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      subscription.dispose();
      const diagnostics = vscode.languages.getDiagnostics(uri);
      if (diagnostics.length > 0) {
        logTest(
          `[diagnostics-timeout] ${diagnostics
            .map((diag) => diag.message)
            .join(" | ")}`
        );
      } else {
        logTest("[diagnostics-timeout] no diagnostics");
      }
      const allDiagnostics = vscode.languages.getDiagnostics();
      if (allDiagnostics.length > 0) {
        const summary = allDiagnostics
          .map(
            ([docUri, items]) =>
              `${docUri.toString()} (${items.length})`
          )
          .join(", ");
        logTest(`[diagnostics-timeout] all: ${summary}`);
      }
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
      if (event.uris.some((changed) => changed.toString() === uri.toString())) {
        check();
      }
    });

    check();
  });
}

export async function getQuickFixTitles(
  uri: vscode.Uri,
  range: vscode.Range
): Promise<string[]> {
  const actions = await vscode.commands.executeCommand<
    Array<vscode.CodeAction | vscode.Command>
  >(
    "vscode.executeCodeActionProvider",
    uri,
    range,
    vscode.CodeActionKind.QuickFix.value
  );
  return (actions ?? [])
    .map((action) => action.title)
    .filter((title) => typeof title === "string");
}

export function diagnosticCode(item: vscode.Diagnostic): string {
  const code = item.code as
    | string
    | number
    | { value?: string | number }
    | undefined;
  if (typeof code === "string" || typeof code === "number") {
    return String(code);
  }
  if (code && typeof code === "object" && "value" in code) {
    return String(code.value ?? "");
  }
  return "";
}
