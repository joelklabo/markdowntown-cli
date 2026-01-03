import path from "node:path";
import fs from "node:fs/promises";
import type { Browser, BrowserContext, Page } from "playwright";

function slugify(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "unknown";
}

function currentTestName(): string | null {
  const globalExpect = (globalThis as { expect?: { getState?: () => { currentTestName?: string } } }).expect;
  return globalExpect?.getState?.().currentTestName ?? null;
}

function artifactsDir(label?: string): string {
  const testName = currentTestName() ?? "unknown";
  const testSlug = slugify(testName);
  const labelSlug = label ? slugify(label) : undefined;
  return path.join(process.cwd(), "test-results", "e2e", labelSlug ? `${testSlug}__${labelSlug}` : testSlug);
}

export async function withE2EPage(
  browser: Browser,
  contextOptions: Parameters<Browser["newContext"]>[0],
  fn: (page: Page, context: BrowserContext) => Promise<void>,
  label?: string
) {
  const dir = artifactsDir(label);
  const videoPath = process.env.E2E_VIDEO_PATH;
  const videoLabel = process.env.E2E_VIDEO_LABEL;
  const shouldRecordVideo = Boolean(videoPath && (!videoLabel || (label && label === videoLabel)));
  const recordVideo = shouldRecordVideo ? { dir: path.dirname(videoPath!) } : undefined;
  await fs.mkdir(dir, { recursive: true });
  if (recordVideo) {
    await fs.mkdir(recordVideo.dir, { recursive: true });
  }

  const context = await browser.newContext({
    ...contextOptions,
    ...(recordVideo ? { recordVideo } : {}),
  });
  if (recordVideo) {
    const page = await context.newPage();
    await page.goto("about:blank");
    await page.waitForTimeout(300);
    await page.close();
  }
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const video = recordVideo ? page.video() : null;

  let error: unknown;
  try {
    await fn(page, context);
  } catch (caught) {
    error = caught;
    await page
      .screenshot({
        path: path.join(dir, "failure.png"),
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    if (error) {
      await context.tracing.stop({ path: path.join(dir, "trace.zip") }).catch(() => {});
    } else {
      await context.tracing.stop().catch(() => {});
    }
    await context.close().catch(() => {});
  }

  if (video && videoPath && shouldRecordVideo) {
    const source = await video.path();
    await fs.rm(videoPath, { force: true }).catch(() => {});
    await fs.rename(source, videoPath);
  }

  if (error) throw error;
}
