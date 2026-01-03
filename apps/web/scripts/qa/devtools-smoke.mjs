import { chromium } from "playwright";

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const url = getArg("--url") ?? process.env.DEVTOOLS_SMOKE_URL ?? "http://localhost:3000";
const timeoutMs = Number(getArg("--timeout") ?? process.env.DEVTOOLS_SMOKE_TIMEOUT ?? "15000");
const waitMs = Number(getArg("--wait") ?? process.env.DEVTOOLS_SMOKE_WAIT ?? "1000");
const retryCount = Number(getArg("--retries") ?? process.env.DEVTOOLS_SMOKE_RETRIES ?? "1");
const retryDelayMs = Number(getArg("--retry-delay") ?? process.env.DEVTOOLS_SMOKE_RETRY_DELAY ?? "500");
const healthEnabled = getArg("--health") === "1" || process.env.DEVTOOLS_SMOKE_HEALTH === "1";
const healthTimeoutMs = Number(getArg("--health-timeout") ?? process.env.DEVTOOLS_SMOKE_HEALTH_TIMEOUT ?? "2000");

const warnings = [];
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const badResponses = [];

const shouldIgnoreResponse = (responseUrl, status) => {
  if (status !== 404) return false;
  return responseUrl.endsWith("/favicon.ico") || responseUrl.endsWith("/apple-touch-icon.png");
};

const shouldIgnoreRequestFailure = (request, errorText) => {
  if (errorText !== "net::ERR_ABORTED") return false;
  if (!request.url().includes("_rsc=")) return false;
  if (request.method() !== "GET") return false;
  if (request.resourceType() !== "fetch") return false;
  if (request.isNavigationRequest()) return false;
  // Next.js RSC fetches can be canceled during client transitions; ignore only these benign aborts.
  return true;
};

const logSection = (title) => {
  process.stdout.write(`\n${title}\n`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeHealth = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), healthTimeoutMs);
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeoutId);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    clearTimeout(timeoutId);
    return { ok: false, error };
  }
};

const gotoWithRetries = async (page) => {
  const attempts = Math.max(1, retryCount + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
      if (response && response.ok()) {
        return response;
      }
      lastError = new Error(`Navigation failed with status ${response?.status() ?? 0}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      process.stdout.write(`Retrying navigation (${attempt}/${attempts})...\n`);
      await wait(retryDelayMs);
    }
  }

  throw lastError ?? new Error("Navigation failed");
};

const main = async () => {
  if (healthEnabled) {
    const health = await probeHealth();
    if (health.ok) {
      process.stdout.write(`Health check OK: ${health.status}\n`);
    } else {
      const reason = health.error?.name ? `${health.error.name}: ${health.error.message}` : "unreachable";
      process.stdout.write(`Health check failed (${reason}). Continuing with browser retry.\n`);
    }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (message) => {
    const type = message.type();
    if (type === "warning") {
      warnings.push(message.text());
    }
    if (type === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    if (shouldIgnoreRequestFailure(request, failure?.errorText ?? "unknown")) return;
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      errorText: failure?.errorText ?? "unknown",
    });
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status < 400 || shouldIgnoreResponse(response.url(), status)) return;
    const resourceType = response.request().resourceType();
    if (resourceType === "document" || resourceType === "xhr" || resourceType === "fetch" || status >= 500) {
      badResponses.push({
        url: response.url(),
        status,
        resourceType,
      });
    }
  });

  const response = await gotoWithRetries(page);
  if (!response || !response.ok()) {
    badResponses.push({
      url,
      status: response?.status() ?? 0,
      resourceType: "document",
    });
  }

  await page.waitForTimeout(waitMs);
  await browser.close();

  if (warnings.length || consoleErrors.length || pageErrors.length || requestFailures.length || badResponses.length) {
    logSection("DevTools smoke check failed");
    if (warnings.length) {
      logSection("Console warnings");
      warnings.forEach((entry) => process.stdout.write(`- ${entry}\n`));
    }
    if (consoleErrors.length) {
      logSection("Console errors");
      consoleErrors.forEach((entry) => process.stdout.write(`- ${entry}\n`));
    }
    if (pageErrors.length) {
      logSection("Page errors");
      pageErrors.forEach((entry) => process.stdout.write(`- ${entry}\n`));
    }
    if (requestFailures.length) {
      logSection("Request failures");
      requestFailures.forEach((entry) =>
        process.stdout.write(`- ${entry.method} ${entry.url} (${entry.errorText})\n`),
      );
    }
    if (badResponses.length) {
      logSection("Bad responses");
      badResponses.forEach((entry) =>
        process.stdout.write(`- ${entry.status} ${entry.resourceType} ${entry.url}\n`),
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("DevTools smoke OK: no console warnings/errors or bad network responses.\n");
};

main().catch((error) => {
  process.stderr.write(`DevTools smoke check crashed: ${error.message}\n`);
  process.exit(1);
});
