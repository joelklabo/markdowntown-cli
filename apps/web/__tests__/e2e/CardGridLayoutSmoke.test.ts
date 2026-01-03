import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

type Rect = { x: number; y: number; width: number; height: number };

function overlaps(a: Rect, b: Rect, tolerance = 2) {
  const ax2 = a.x + a.width - tolerance;
  const ay2 = a.y + a.height - tolerance;
  const bx2 = b.x + b.width - tolerance;
  const by2 = b.y + b.height - tolerance;
  return a.x + tolerance < bx2 && ax2 > b.x + tolerance && a.y + tolerance < by2 && ay2 > b.y + tolerance;
}

describe("Library layout smoke", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("library renders without overlaps or horizontal overflow", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      const paths = [
        "/library",
        "/library?type=snippet",
        "/library?type=template",
        "/library?type=file",
        "/browse",
        "/browse?type=snippet",
        "/browse?type=template",
        "/browse?type=file",
        "/templates",
        "/tags",
      ];

      for (const path of paths) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(page.url()).toMatch(/\/library/);

        const rows = page.getByTestId("artifact-row");
        const count = await rows.count();

        if (count === 0) {
          // Empty states are allowed but should render cleanly.
          await page.getByText(/no public items found|no public items/i).first().waitFor({ state: "visible" });
        } else {
          const sampleCount = Math.min(count, 12);
          const boxes = (await rows.evaluateAll(
            (els, n) =>
              els.slice(0, n).map((el) => {
                const r = el.getBoundingClientRect();
                return {
                  x: r.left + window.scrollX,
                  y: r.top + window.scrollY,
                  width: r.width,
                  height: r.height,
                };
              }),
            sampleCount
          )) as Rect[];

          for (const box of boxes) {
            expect(box.width).toBeGreaterThan(40);
            expect(box.height).toBeGreaterThan(40);
          }

          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              expect(overlaps(boxes[i], boxes[j])).toBe(false);
            }
          }
        }

        const scrollWidth = await page.evaluate(
          () => document.scrollingElement?.scrollWidth ?? document.body.scrollWidth
        );
        const innerWidth = await page.evaluate(() => window.innerWidth);
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 24);
      }

      // Mobile overflow sanity on library
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/library", { waitUntil: "domcontentloaded" });
      const mobileScrollWidth = await page.evaluate(
        () => document.scrollingElement?.scrollWidth ?? document.body.scrollWidth
      );
      const mobileInnerWidth = await page.evaluate(() => window.innerWidth);
      expect(mobileScrollWidth).toBeLessThanOrEqual(mobileInnerWidth + 32);
    });
  });
});
