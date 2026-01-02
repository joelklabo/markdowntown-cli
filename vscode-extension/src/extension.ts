import * as cp from "node:child_process";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  StreamInfo,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("markdowntown");
  const config = vscode.workspace.getConfiguration("markdowntown");
  const serverPath = config.get<string>("serverPath", "markdowntown");

  const serverOptions: ServerOptions = (): Promise<StreamInfo> => {
    const child = cp.spawn(serverPath, ["serve"], {
      stdio: ["pipe", "pipe", "pipe"],
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
    ],
    outputChannel,
  };

  client = new LanguageClient(
    "markdowntown",
    "markdowntown",
    serverOptions,
    clientOptions
  );

  void client.start().catch((err) => {
    outputChannel.appendLine(
      `Failed to start markdowntown language client: ${err.message}`
    );
  });

  context.subscriptions.push(outputChannel, {
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
