import type { Page } from "@playwright/test";

const HIDE_OVERLAYS = `
nextjs-portal{display:none !important;}
[data-nextjs-devtools]{display:none !important;}
button[aria-label="Open Next.js Dev Tools"],
button[aria-label="Open issues overlay"],
button[aria-label="Collapse issues badge"]{display:none !important;}
*::-webkit-scrollbar{width:0 !important;height:0 !important;}
*{caret-color:transparent !important;animation:none !important;transition:none !important;}
`;
const WHATS_NEW_KEY = "mdt_whats_new_dismissed_v2025-12";

type VisualPageOptions = {
  theme?: "light" | "dark";
};

const NAV_TIMEOUT_MS = 90_000;
const NAV_ATTEMPTS = 3;
const NEXT_ERROR_TIMEOUT_MS = 1000;
const NEXT_ERROR_RETRIES = 2;

async function gotoWithRetries(page: Page, url: string, attempts = NAV_ATTEMPTS) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await page.waitForTimeout(500);
      }
    }
  }
  throw lastError;
}

async function disableNextDevtoolsIndicator(page: Page) {
  try {
    await page.request.post("/__nextjs_devtools_config", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ disableDevIndicator: true }),
    });
  } catch {
    // ignore devtools config failures
  }
}

async function prepareVisualPage(page: Page, options: VisualPageOptions = {}) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((opts: VisualPageOptions & { storageKey: string; visualCss: string }) => {
    (window as unknown as { __MDT_VISUAL_TEST__?: boolean }).__MDT_VISUAL_TEST__ = true;
    window.localStorage.setItem(opts.storageKey, "1");
    if (opts.theme) {
      window.localStorage.setItem("theme", opts.theme);
      const root = document.documentElement;
      root.dataset.theme = opts.theme;
      if (opts.theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
    const style = document.createElement("style");
    style.setAttribute("data-visual-test", "true");
    style.textContent = opts.visualCss;
    document.head.appendChild(style);
  }, { ...options, storageKey: WHATS_NEW_KEY, visualCss: HIDE_OVERLAYS });
}

async function hasNextRuntimeError(page: Page) {
  try {
    const copyErrorInfo = page.getByRole("button", { name: "Copy Error Info" });
    if (await copyErrorInfo.isVisible({ timeout: NEXT_ERROR_TIMEOUT_MS })) {
      return true;
    }
    const runtimeDialog = page.getByRole("dialog").filter({ hasText: /Runtime|SyntaxError|ReferenceError|Invariant/i });
    return await runtimeDialog.first().isVisible({ timeout: NEXT_ERROR_TIMEOUT_MS });
  } catch {
    return false;
  }
}

async function waitForImages(page: Page, timeoutMs = 5000) {
  await page.evaluate(async (timeout) => {
    const images = Array.from(document.images);
    if (images.length === 0) return;
    const isVisible = (img: HTMLImageElement) => {
      const rect = img.getBoundingClientRect();
      return rect.bottom >= 0 && rect.top <= window.innerHeight;
    };
    const pending = Promise.all(images.map((img) => {
      if (!isVisible(img)) return Promise.resolve();
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }));
    await Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, timeout))]);
  }, timeoutMs);
}

async function settleVisualPage(page: Page, options: VisualPageOptions = {}) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch {
    try {
      await page.waitForLoadState("load", { timeout: 15000 });
    } catch {
      /* ignore */
    }
  }
  await page.evaluate(async () => {
    const fonts = document.fonts;
    if (!fonts?.ready) return;
    try {
      await Promise.race([
        fonts.ready,
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch {
      /* ignore */
    }
  });
  if (options.theme) {
    await page.evaluate((theme) => {
      const root = document.documentElement;
      if (!root) return;
      root.dataset.theme = theme;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }, options.theme);
    await page.waitForFunction(
      (theme) => {
        const root = document.documentElement;
        if (!root) return false;
        const matchesTheme = root.dataset.theme === theme;
        const classMatches = theme === "dark" ? root.classList.contains("dark") : !root.classList.contains("dark");
        return matchesTheme && classMatches;
      },
      options.theme,
      { timeout: 5000 }
    );
  }
  await waitForImages(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(300);
}

export async function gotoVisualPage(page: Page, url: string, options: VisualPageOptions = {}) {
  await disableNextDevtoolsIndicator(page);
  await prepareVisualPage(page, options);
  await gotoWithRetries(page, url);
  await settleVisualPage(page, options);
  for (let attempt = 0; attempt < NEXT_ERROR_RETRIES; attempt += 1) {
    if (!(await hasNextRuntimeError(page))) return;
    await gotoWithRetries(page, url, 1);
    await settleVisualPage(page, options);
  }
}

export async function gotoLivePage(page: Page, url: string, options: VisualPageOptions = {}) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await disableNextDevtoolsIndicator(page);
  await page.addInitScript((opts: VisualPageOptions & { storageKey: string }) => {
    window.localStorage.setItem(opts.storageKey, "1");
    if (opts.theme) {
      window.localStorage.setItem("theme", opts.theme);
      const root = document.documentElement;
      root.dataset.theme = opts.theme;
      if (opts.theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, { ...options, storageKey: WHATS_NEW_KEY });
  await gotoWithRetries(page, url);
  await settleVisualPage(page, options);
  for (let attempt = 0; attempt < NEXT_ERROR_RETRIES; attempt += 1) {
    if (!(await hasNextRuntimeError(page))) return;
    await gotoWithRetries(page, url, 1);
    await settleVisualPage(page, options);
  }
}
