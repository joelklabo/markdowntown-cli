const url = process.env.MCP_HEALTH_URL ?? "http://localhost:3000";
const timeoutMs = Number(process.env.MCP_HEALTH_TIMEOUT ?? "2000");
const retryCount = Number(process.env.MCP_HEALTH_RETRIES ?? "2");
const retryDelayMs = Number(process.env.MCP_HEALTH_RETRY_DELAY ?? "300");

const formatMs = (value) => `${Math.round(value)}ms`;

const log = (message) => {
  process.stdout.write(`${message}\n`);
};

const logSection = (title) => {
  process.stdout.write(`\n${title}\n`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const attemptFetch = async (attempt) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return { ok: true, response, durationMs: Date.now() - start };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error,
      durationMs: Date.now() - start,
      attempt,
    };
  }
};

let lastFailure = null;
const totalAttempts = Math.max(1, retryCount + 1);

for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
  const result = await attemptFetch(attempt);
  if (result.ok) {
    const statusLine = `HTTP ${result.response.status} (${formatMs(result.durationMs)})`;
    if (result.response.ok) {
      log(`MCP health check OK: ${statusLine}`);
      log("Next: open a fresh DevTools MCP page and capture console/network.");
    } else {
      log(`MCP health check warning: ${statusLine}`);
      log("If the app is expected to be running, restart the dev server.");
    }
    logSection("Troubleshooting");
    log(`- Confirm the dev server: pnpm dev`);
    log(
      `- Retry with: MCP_HEALTH_URL=${url} MCP_HEALTH_TIMEOUT=${timeoutMs} MCP_HEALTH_RETRIES=${retryCount} node scripts/mcp-devtools-health.mjs`,
    );
    log("- If MCP timeouts persist, restart the MCP bridge/agent.");
    log("- See docs/qa/devtools-troubleshooting.md for MCP timeout steps.");
    lastFailure = null;
    break;
  }

  lastFailure = result;
  const errorName = result.error?.name ?? "Error";
  const errorMessage = result.error?.message ?? "unknown failure";
  const timeoutSuffix = errorName === "AbortError" ? ` after ${formatMs(timeoutMs)}` : "";
  log(`MCP health check attempt ${attempt}/${totalAttempts} failed: ${errorName}${timeoutSuffix}`);
  log(`Details: ${errorMessage}`);

  if (attempt < totalAttempts) {
    await wait(retryDelayMs);
  }
}

if (lastFailure) {
  log("MCP health check failed after retries.");
  log("Ensure the dev server is running and reachable.");
  log(
    `Retry with: MCP_HEALTH_URL=${url} MCP_HEALTH_TIMEOUT=${timeoutMs} MCP_HEALTH_RETRIES=${retryCount} node scripts/mcp-devtools-health.mjs`,
  );
}
