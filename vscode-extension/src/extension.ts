import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  State,
  StreamInfo,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

type DiagnosticsSettings = {
  enabled: boolean;
  delayMs: number;
  rulesEnabled: string[];
  rulesDisabled: string[];
  severityOverrides: Record<string, string>;
  includeRelatedInfo: boolean;
  includeEvidence: boolean;
  redactPaths: string;
};

function readDiagnosticsSettings(): DiagnosticsSettings {
  const config = vscode.workspace.getConfiguration("markdowntown");
  return {
    enabled: config.get<boolean>("diagnostics.enabled", true),
    delayMs: config.get<number>("diagnostics.delayMs", 500),
    rulesEnabled: config.get<string[]>("diagnostics.rulesEnabled", []),
    rulesDisabled: config.get<string[]>("diagnostics.rulesDisabled", []),
    severityOverrides: config.get<Record<string, string>>(
      "diagnostics.severityOverrides",
      {}
    ),
    includeRelatedInfo: config.get<boolean>(
      "diagnostics.includeRelatedInfo",
      true
    ),
    includeEvidence: config.get<boolean>("diagnostics.includeEvidence", true),
    redactPaths: config.get<string>("diagnostics.redactPaths", "never"),
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("markdowntown");
  const config = vscode.workspace.getConfiguration("markdowntown");
  const serverPath = config.get<string>("serverPath", "markdowntown");
  const registryPathFromConfig = config.get<string>("registryPath", "").trim();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let registryPath = registryPathFromConfig;
  if (!registryPath && workspaceRoot) {
    const candidate = path.join(workspaceRoot, "data", "ai-config-patterns.json");
    if (fs.existsSync(candidate)) {
      registryPath = candidate;
    }
  }
  outputChannel.appendLine(`Starting markdowntown LSP (${serverPath})`);

  const serverOptions: ServerOptions = (): Promise<StreamInfo> => {
    const env = { ...process.env };
    if (registryPath) {
      env.MARKDOWNTOWN_REGISTRY = registryPath;
      outputChannel.appendLine(`Using registry: ${registryPath}`);
    }

    const child = cp.spawn(serverPath, ["serve"], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        outputChannel.append(data.toString());
      });
    }

    child.on("error", (err) => {
      outputChannel.appendLine(
        `Failed to start markdowntown server: ${err.message}`
      );
      void vscode.window.showErrorMessage(
        `markdowntown: failed to start server (${serverPath}). ${err.message}`
      );
    });

    if (!child.stdout || !child.stdin) {
      return Promise.reject(
        new Error("Failed to start markdowntown server stdio streams.")
      );
    }

    return Promise.resolve({
      reader: child.stdout,
      writer: child.stdin,
    });
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "markdown" },
      { scheme: "file", language: "json" },
      { scheme: "file", language: "yaml" },
      { scheme: "file", language: "toml" },
      { scheme: "file", language: "instructions" },
    ],
    outputChannel,
    initializationOptions: {
      diagnostics: readDiagnosticsSettings(),
    },
  };

  client = new LanguageClient(
    "markdowntown",
    "markdowntown",
    serverOptions,
    clientOptions
  );

  const stateDisposable = client.onDidChangeState((event) => {
    if (event.newState === State.Running) {
      outputChannel.appendLine("markdowntown LSP ready");
    }
  });

  const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration("markdowntown")) {
      return;
    }
    if (!client) {
      return;
    }
    const diagnostics = readDiagnosticsSettings();
    outputChannel.appendLine("markdowntown diagnostics settings updated");
    void client.sendNotification("workspace/didChangeConfiguration", {
      settings: { diagnostics },
    });
  });

  void client.start().catch((err) => {
    outputChannel.appendLine(
      `Failed to start markdowntown language client: ${err.message}`
    );
    void vscode.window.showErrorMessage(
      `markdowntown: language client failed (${err.message})`
    );
  });

  context.subscriptions.push(outputChannel, stateDisposable, configDisposable, {
    dispose: () => {
      if (client) {
        void client.stop();
      }
    },
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
