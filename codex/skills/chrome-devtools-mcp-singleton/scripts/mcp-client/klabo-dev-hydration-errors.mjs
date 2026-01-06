import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_CMD = "npx";
const MCP_ARGS = ["-y", "chrome-devtools-mcp@latest", "--headless", "--isolated"];
const URL = "http://localhost:3000/posts/introducing-ackchyually";

const client = new Client(
  { name: "klabo-dev-hydration-errors", version: "1.0.0" },
  { capabilities: {} }
);
const transport = new StdioClientTransport({ command: MCP_CMD, args: MCP_ARGS });

function pickTool(toolNames, candidates) {
  for (const candidate of candidates) {
    const direct = toolNames.find((name) => name === candidate);
    if (direct) return direct;
    const suffix = toolNames.find((name) => name.endsWith(candidate));
    if (suffix) return suffix;
  }
  return null;
}

function extractText(result) {
  const textBlock = result?.content?.find((c) => c.type === "text")?.text;
  return textBlock || "";
}

function parsePageList(text) {
  const lines = text.split("\n");
  const pages = [];
  for (const line of lines) {
    const match = line.match(/^(\d+):\s+(.*)$/);
    if (match) pages.push({ idx: Number(match[1]), label: match[2] });
  }
  return pages;
}

function parseConsole(text) {
  const lines = text.split("\n");
  const items = [];
  for (const line of lines) {
    const match = line.match(/msgid=(\d+) \[(\w+)\] (.*)$/);
    if (match) items.push({ msgid: Number(match[1]), level: match[2], message: match[3] });
  }
  return items;
}

async function waitForLoad(evalTool) {
  for (let i = 0; i < 30; i += 1) {
    const ready = await client.callTool({
      name: evalTool,
      arguments: { function: "() => document.readyState" },
    });
    const text = extractText(ready);
    if (text.includes("\"complete\"")) return;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function run() {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  const toolNames = tools.map((t) => t.name);

  const openTool = pickTool(toolNames, ["new_page", "open_page"]);
  const listTool = pickTool(toolNames, ["list_pages", "pages"]);
  const selectTool = pickTool(toolNames, ["select_page", "selectPage"]);
  const evalTool = pickTool(toolNames, ["evaluate_script", "eval"]);
  const consoleTool = pickTool(toolNames, ["list_console_messages"]);
  const consoleGetTool = pickTool(toolNames, ["get_console_message"]);

  if (!openTool || !listTool || !selectTool || !evalTool) {
    throw new Error("Missing required MCP tools");
  }

  await client.callTool({ name: openTool, arguments: { url: URL, timeout: 120000 } });
  const pagesResult = await client.callTool({ name: listTool, arguments: {} });
  const pages = parsePageList(extractText(pagesResult));
  const page = pages[pages.length - 1];
  await client.callTool({ name: selectTool, arguments: { pageIdx: page.idx, bringToFront: true } });
  await waitForLoad(evalTool);
  await new Promise((r) => setTimeout(r, 1500));

  if (consoleTool) {
    const consoleRes = await client.callTool({
      name: consoleTool,
      arguments: { includePreservedMessages: true },
    });
    const items = parseConsole(extractText(consoleRes));
    const errors = items.filter((item) => item.level === "error" || item.level === "warning");
    console.log(JSON.stringify(errors, null, 2));
    if (consoleGetTool) {
      for (const item of errors) {
        const detail = await client.callTool({ name: consoleGetTool, arguments: { msgid: item.msgid } });
        console.log(JSON.stringify(detail));
      }
    }
  }
}

try {
  await run();
} catch (err) {
  console.error("ERROR:", err?.message || err);
  process.exitCode = 1;
} finally {
  try {
    await client.close();
  } catch {}
  try {
    await transport.close();
  } catch {}
}
