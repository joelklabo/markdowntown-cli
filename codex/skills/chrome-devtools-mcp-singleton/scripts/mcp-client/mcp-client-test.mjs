import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_CMD = "npx";
const MCP_ARGS = ["-y", "chrome-devtools-mcp@latest", "--headless", "--isolated"];
const TEST_ID = process.env.TEST_ID ? `[${process.env.TEST_ID}] ` : "";
const SKIP_PERF = process.env.SKIP_PERF === "1";
const URLS = process.env.URLS
  ? process.env.URLS.split(",").map((url) => url.trim()).filter(Boolean)
  : [
      "https://example.com",
      "https://www.wikipedia.org",
      "https://www.iana.org/domains/reserved",
      "https://developer.mozilla.org",
      "https://www.mozilla.org",
    ];

const client = new Client(
  { name: "devtools-mcp-smoke", version: "1.0.0" },
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

async function callIfExists(tools, nameCandidates, args) {
  const toolNames = tools.map((t) => t.name);
  const toolName = pickTool(toolNames, nameCandidates);
  if (!toolName) {
    return { skipped: true, reason: `missing tool for ${nameCandidates.join("/")}` };
  }
  const result = await client.callTool({ name: toolName, arguments: args });
  return { skipped: false, toolName, result };
}

function extractListPagesText(result) {
  const textBlock = result?.content?.find((c) => c.type === "text")?.text;
  return textBlock || "";
}

function parsePageList(text) {
  const lines = text.split("\n");
  const pages = [];
  for (const line of lines) {
    const match = line.match(/^(\d+):\s+(.*)$/);
    if (match) {
      pages.push({ idx: Number(match[1]), label: match[2] });
    }
  }
  return pages;
}

function dataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function logSection(title) {
  console.log(`\n${TEST_ID}=== ${title} ===`);
}

try {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  const toolNames = tools.map((t) => t.name);
  console.log(`${TEST_ID}Tools:`, toolNames.join(", "));

  const openTool = pickTool(toolNames, ["new_page", "open_page"]);
  const listTool = pickTool(toolNames, ["list_pages", "pages"]);
  const selectTool = pickTool(toolNames, ["select_page", "selectPage"]);
  const evalTool = pickTool(toolNames, ["evaluate_script", "eval"]);
  const snapshotTool = pickTool(toolNames, ["take_snapshot", "snapshot"]);
  const waitTool = pickTool(toolNames, ["wait_for", "waitFor"]);
  const fillTool = pickTool(toolNames, ["fill", "type"]);
  const clickTool = pickTool(toolNames, ["click"]);
  const consoleTool = pickTool(toolNames, ["list_console_messages"]);
  const networkTool = pickTool(toolNames, ["list_network_requests"]);
  const perfStart = pickTool(toolNames, ["performance_start_trace"]);
  const perfStop = pickTool(toolNames, ["performance_stop_trace"]);

  if (!openTool || !listTool || !selectTool || !evalTool || !snapshotTool) {
    console.error("ERROR: missing required tools for smoke tests");
    process.exitCode = 1;
  } else {
    logSection("Open multiple pages");
    for (const url of URLS) {
      await client.callTool({ name: openTool, arguments: { url, timeout: 120000 } });
      console.log(`${TEST_ID}opened:`, url);
    }

    logSection("List pages + titles");
    const listPages = await client.callTool({ name: listTool, arguments: {} });
    const listText = extractListPagesText(listPages);
    const pages = parsePageList(listText);
    console.log(`${TEST_ID}pages:`, pages.map((p) => `${p.idx}:${p.label}`).join(" | "));

    for (const page of pages.slice(1, Math.min(6, pages.length))) {
      await client.callTool({
        name: selectTool,
        arguments: { pageIdx: page.idx, bringToFront: true },
      });
      const title = await client.callTool({
        name: evalTool,
        arguments: { function: "() => document.title" },
      });
      console.log(`${TEST_ID}page ${page.idx} title:`, JSON.stringify(title));
    }

    logSection("Interaction test (data URL)");
    const formHtml = `<!doctype html>
      <html>
        <head><title>MCP Form Test</title></head>
        <body>
          <label>Name <input id="name" aria-label="Name" /></label>
          <button id="submit" aria-label="Submit">Submit</button>
          <div id="out" aria-label="Output"></div>
          <script>
            document.getElementById("submit").addEventListener("click", () => {
              const value = document.getElementById("name").value;
              document.getElementById("out").textContent = "OK: " + value;
            });
          </script>
        </body>
      </html>`;
    await client.callTool({ name: openTool, arguments: { url: dataUrl(formHtml), timeout: 120000 } });
    const formPages = await client.callTool({ name: listTool, arguments: {} });
    const formList = parsePageList(extractListPagesText(formPages));
    const formPage = formList[formList.length - 1];
    await client.callTool({ name: selectTool, arguments: { pageIdx: formPage.idx, bringToFront: true } });

    const snap = await client.callTool({ name: snapshotTool, arguments: {} });
    const snapText = extractListPagesText(snap);
    const inputMatch = snapText.match(/uid=([^\\s]+)\\s+TextField\\s+\"Name\"/);
    const buttonMatch = snapText.match(/uid=([^\\s]+)\\s+button\\s+\"Submit\"/i);
    if (fillTool && clickTool && inputMatch && buttonMatch) {
      await client.callTool({ name: fillTool, arguments: { uid: inputMatch[1], value: "Codex" } });
      await client.callTool({ name: clickTool, arguments: { uid: buttonMatch[1] } });
    } else {
      console.log(`${TEST_ID}fallback: interaction via JS (uid not found)`);
      await client.callTool({
        name: evalTool,
        arguments: {
          function:
            "() => { document.getElementById('name').value = 'Codex'; document.getElementById('submit').click(); }",
        },
      });
    }
    if (waitTool) {
      await client.callTool({ name: waitTool, arguments: { text: "OK: Codex", timeout: 60000 } });
    }
    const output = await client.callTool({
      name: evalTool,
      arguments: { function: "() => document.getElementById('out').textContent" },
    });
    console.log(`${TEST_ID}interaction output:`, JSON.stringify(output));

    logSection("Console + network capture");
    const logHtml = `<!doctype html>
      <html><head><title>MCP Logs</title></head>
      <body>
        <script>
          console.log("mcp-log:hello");
          console.error("mcp-log:error");
        </script>
      </body></html>`;
    await client.callTool({ name: openTool, arguments: { url: dataUrl(logHtml), timeout: 120000 } });
    const logPages = await client.callTool({ name: listTool, arguments: {} });
    const logList = parsePageList(extractListPagesText(logPages));
    const logPage = logList[logList.length - 1];
    await client.callTool({ name: selectTool, arguments: { pageIdx: logPage.idx, bringToFront: true } });
    if (consoleTool) {
      const consoleMessages = await client.callTool({
        name: consoleTool,
        arguments: { includePreservedMessages: true },
      });
      console.log(`${TEST_ID}console messages:`, JSON.stringify(consoleMessages));
    }
    if (networkTool) {
      const networkRequests = await client.callTool({
        name: networkTool,
        arguments: { includePreservedRequests: true },
      });
      console.log(`${TEST_ID}network requests:`, JSON.stringify(networkRequests));
    }

    logSection("Performance trace");
    if (perfStart && perfStop && !SKIP_PERF) {
      await client.callTool({ name: perfStart, arguments: { autoStop: false, reload: true } });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const perf = await client.callTool({ name: perfStop, arguments: {} });
      console.log(`${TEST_ID}performance trace:`, JSON.stringify(perf));
    } else {
      console.log(`${TEST_ID}performance tools not available or skipped`);
    }
  }
} catch (err) {
  console.error("ERROR:", err?.message || err);
  process.exitCode = 1;
} finally {
  const timer = setTimeout(() => process.exit(process.exitCode ?? 0), 2000);
  timer.unref();
  try {
    await client.close();
  } catch (err) {
    console.error("ERROR: client close:", err?.message || err);
  }
  try {
    await transport.close();
  } catch (err) {
    console.error("ERROR: transport close:", err?.message || err);
  }
}
