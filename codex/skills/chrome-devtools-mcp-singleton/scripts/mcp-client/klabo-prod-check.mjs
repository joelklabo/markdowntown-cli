import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_CMD = "npx";
const MCP_ARGS = ["-y", "chrome-devtools-mcp@latest", "--headless", "--isolated"];
const URLS = [
  "https://klabo.world/",
  "https://klabo.world/posts",
  "https://klabo.world/posts/introducing-ackchyually",
  "https://klabo.world/projects",
  "https://klabo.world/apps",
  "https://klabo.world/search?q=nostr",
  "https://klabo.world/dashboards",
  "https://klabo.world/about",
  "https://klabo.world/admin",
];

const client = new Client(
  { name: "klabo-prod-check", version: "1.0.0" },
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
    const match = line.match(/msgid=\d+ \[(\w+)\] (.*)$/);
    if (match) items.push({ level: match[1], message: match[2] });
  }
  return items;
}

function parseNetwork(text) {
  const lines = text.split("\n");
  const items = [];
  for (const line of lines) {
    const match = line.match(/reqid=(\d+) (\w+) (.+) \[(.+)\]/);
    if (match) {
      const statusMatch = match[4].match(/(\d{3})/);
      items.push({
        reqid: Number(match[1]),
        method: match[2],
        url: match[3],
        status: statusMatch ? Number(statusMatch[1]) : null,
        raw: match[4],
      });
    }
  }
  return items;
}

function parseEvalJson(text) {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
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
  const networkTool = pickTool(toolNames, ["list_network_requests"]);

  if (!openTool || !listTool || !selectTool || !evalTool) {
    throw new Error("Missing required MCP tools");
  }

  const report = [];

  for (const url of URLS) {
    await client.callTool({ name: openTool, arguments: { url, timeout: 120000 } });
    const pagesResult = await client.callTool({ name: listTool, arguments: {} });
    const pages = parsePageList(extractText(pagesResult));
    const page = pages[pages.length - 1];
    await client.callTool({ name: selectTool, arguments: { pageIdx: page.idx, bringToFront: true } });
    await waitForLoad(evalTool);
    await new Promise((r) => setTimeout(r, 1500));

    const titleRes = await client.callTool({
      name: evalTool,
      arguments: { function: "() => document.title" },
    });
    const title = parseEvalJson(extractText(titleRes));

    let consoleItems = [];
    if (consoleTool) {
      const consoleRes = await client.callTool({
        name: consoleTool,
        arguments: { includePreservedMessages: true },
      });
      consoleItems = parseConsole(extractText(consoleRes));
    }

    let networkItems = [];
    if (networkTool) {
      const networkRes = await client.callTool({
        name: networkTool,
        arguments: { includePreservedRequests: true },
      });
      networkItems = parseNetwork(extractText(networkRes));
    }

    report.push({
      url,
      title,
      consoleErrors: consoleItems.filter((item) => item.level === "error" || item.level === "warning"),
      networkErrors: networkItems.filter((item) => item.status && item.status >= 400),
    });
  }

  console.log(JSON.stringify({ report }, null, 2));
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
