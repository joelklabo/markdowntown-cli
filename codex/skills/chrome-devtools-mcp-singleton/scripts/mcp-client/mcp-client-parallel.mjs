import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testScript = resolve(__dirname, "mcp-client-test.mjs");

const runs = [
  {
    id: "A",
    urls: [
      "https://example.com",
      "https://www.wikipedia.org",
      "https://www.iana.org/domains/reserved",
    ],
  },
  {
    id: "B",
    urls: [
      "https://developer.mozilla.org",
      "https://www.mozilla.org",
      "https://www.w3.org",
    ],
  },
];

function runClient({ id, urls }) {
  return new Promise((resolvePromise) => {
    const env = {
      ...process.env,
      TEST_ID: id,
      URLS: urls.join(","),
      SKIP_PERF: "1",
    };
    const child = spawn(process.execPath, [testScript], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("close", (code) => resolvePromise({ id, code }));
  });
}

const results = await Promise.all(runs.map(runClient));
const failed = results.filter((r) => r.code !== 0);
if (failed.length > 0) {
  console.error("Parallel MCP test failed:", failed);
  process.exit(1);
}

console.log("Parallel MCP test OK");
