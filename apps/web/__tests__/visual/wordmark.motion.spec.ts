import { test, expect } from "@playwright/test";
import { gotoLivePage } from "./utils";

const ANIMATION_DISABLED = process.env.NEXT_PUBLIC_WORDMARK_ANIM_V1 === "false";

test.describe("City wordmark motion", () => {
  test("nav banner animates", async ({ page }) => {
    test.skip(ANIMATION_DISABLED, "Wordmark animation disabled via feature flag.");
    await gotoLivePage(page, "/", { theme: "light" });

    const banner = page.locator("header .mdt-wordmark--banner");
    await expect(banner).toBeVisible({ timeout: 30000 });

    const twinkle = banner.locator('[data-mtw-anim="twinkle"]').first();
    await expect(twinkle).toHaveCount(1);

    const inlineStyle = await twinkle.getAttribute("style");
    expect(inlineStyle ?? "").toContain("animation-delay");
  });

  test("animates while playing", async ({ page }) => {
    test.skip(ANIMATION_DISABLED, "Wordmark animation disabled via feature flag.");
    await gotoLivePage(page, "/labs/city-logo?seed=motion-smoke&density=dense&timeScale=2&timeOfDay=0.55", {
      theme: "light",
    });

    const preview = page.getByTestId("city-logo-preview");
    await expect(preview).toBeVisible({ timeout: 30000 });
    await expect(preview).toHaveAttribute("data-snapshot-ready", "true", { timeout: 30000 });

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 600) return;

    await page.waitForTimeout(200);
    const first = await preview.screenshot();

    await page.waitForTimeout(600);
    const second = await preview.screenshot();

    expect(first.equals(second)).toBe(false);
  });
});
