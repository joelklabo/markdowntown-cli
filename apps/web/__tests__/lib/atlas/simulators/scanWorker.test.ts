// @vitest-environment node
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  handleScanWorkerRequest,
  type ScanWorkerResponse,
} from "@/lib/atlas/simulators/workers/scanWorker";

const runRequest = async (request: Parameters<typeof handleScanWorkerRequest>[0]) => {
  const messages: ScanWorkerResponse[] = [];
  await handleScanWorkerRequest(request, (message) => messages.push(message));
  return messages;
};

const getScanResult = (messages: ScanWorkerResponse[]) =>
  messages.find((message) => message.type === "scan_result" && message.origin !== undefined);

const buildZipFile = async (entries: Array<{ path: string; content: string }>, name = "repo.zip") => {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.path, entry.content);
  }
  const buffer = await zip.generateAsync({ type: "uint8array" });
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new File([arrayBuffer], name, { type: "application/zip" });
};

describe("scanWorker", () => {
  it("parses tree input", async () => {
    const messages = await runRequest({ id: 1, type: "parse_tree", text: "AGENTS.md\nREADME.md" });
    const resultMessage = messages.find((message) => message.type === "parse_tree_result");
    expect(resultMessage?.type).toBe("parse_tree_result");
    expect(resultMessage && "result" in resultMessage ? resultMessage.result.paths : []).toEqual([
      "AGENTS.md",
      "README.md",
    ]);
  });

  it("scans zip archives", async () => {
    const file = await buildZipFile([
      { path: "AGENTS.md", content: "# Agents" },
      { path: ".github/copilot-instructions.md", content: "# Copilot" },
    ]);
    const messages = await runRequest({ id: 2, type: "scan_zip", file });
    const result = getScanResult(messages);
    const paths = result && "result" in result ? result.result.tree.files.map((entry) => entry.path) : [];
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".github/copilot-instructions.md");
  });

  it("scans file list uploads", async () => {
    const file = new File(["# Agents"], "AGENTS.md", { type: "text/plain" });
    const messages = await runRequest({ id: 3, type: "scan_file_list", files: [file] });
    const result = getScanResult(messages);
    const paths = result && "result" in result ? result.result.tree.files.map((entry) => entry.path) : [];
    expect(paths).toContain("AGENTS.md");
  });
});
