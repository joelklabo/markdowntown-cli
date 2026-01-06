import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_CMD = "npx";
const MCP_ARGS = ["-y", "chrome-devtools-mcp@latest", "--headless", "--isolated"];
const URL = "https://klabo.world/posts/introducing-ackchyually";

const client = new Client({ name: "klabo-post-nextdata", version: "1.0.0" }, { capabilities: {} });
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
  return text
    .split("\n")
    .map((line) => line.match(/^(\d+):\s+(.*)$/))
    .filter(Boolean)
    .map((match) => ({ idx: Number(match[1]), label: match[2] }));
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
    if (text.includes('"complete"')) return;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function run() {
  await client.connect(transport);
  const toolNames = (await client.listTools()).tools.map((t) => t.name);
  const openTool = pickTool(toolNames, ["new_page", "open_page"]);
  const listTool = pickTool(toolNames, ["list_pages", "pages"]);
  const selectTool = pickTool(toolNames, ["select_page", "selectPage"]);
  const evalTool = pickTool(toolNames, ["evaluate_script", "eval"]);

  if (!openTool || !listTool || !selectTool || !evalTool) {
    throw new Error("Missing required MCP tools");
  }

  await client.callTool({ name: openTool, arguments: { url: URL, timeout: 120000 } });
  const pages = parsePageList(extractText(await client.callTool({ name: listTool, arguments: {} })));
  const page = pages[pages.length - 1];
  await client.callTool({ name: selectTool, arguments: { pageIdx: page.idx, bringToFront: true } });
  await waitForLoad(evalTool);
  await new Promise((r) => setTimeout(r, 1500));

  const nextDataRes = await client.callTool({
    name: evalTool,
    arguments: { function: "() => document.querySelector('script#__NEXT_DATA__')?.textContent || null" },
  });
  const nextData = parseEvalJson(extractText(nextDataRes));
  console.log(JSON.stringify(nextData, null, 2));
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
