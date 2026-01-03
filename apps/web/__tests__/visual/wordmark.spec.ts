import { test, expect } from "@playwright/test";
import { getCityWordmarkPalette } from "../../src/components/wordmark/sim/palette";
import { rgbToCss } from "../../src/components/wordmark/sim/renderSvg";
import { gotoVisualPage } from "./utils";

const PREVIEW_TIMEOUT = 60000;

test.describe("City wordmark visual", () => {
  test("day scene", async ({ page }) => {
    await gotoVisualPage(page, "/labs/city-logo?snapshot=1&timeOfDay=0.55&voxelScale=3&detail=hd");
    const preview = page.getByTestId("city-logo-preview");
    await expect(preview).toBeVisible({ timeout: PREVIEW_TIMEOUT });
    await expect(preview).toHaveAttribute("data-snapshot-ready", "true", { timeout: PREVIEW_TIMEOUT });
    const dayFill = rgbToCss(getCityWordmarkPalette(0.55, "classic").building);
    await expect(preview.locator('[data-mtw="building"]')).toHaveAttribute("fill", dayFill);
    await expect(preview).toHaveScreenshot("wordmark-day.png", { timeout: 10000 });
  });

  test("night scene", async ({ page }) => {
    await gotoVisualPage(page, "/labs/city-logo?snapshot=1&timeOfDay=0.04&voxelScale=3&detail=hd");
    const preview = page.getByTestId("city-logo-preview");
    await expect(preview).toBeVisible({ timeout: PREVIEW_TIMEOUT });
    await expect(preview).toHaveAttribute("data-snapshot-ready", "true", { timeout: PREVIEW_TIMEOUT });
    const nightFill = rgbToCss(getCityWordmarkPalette(0.04, "classic").building);
    await expect(preview.locator('[data-mtw="building"]')).toHaveAttribute("fill", nightFill);
    await expect(preview).toHaveScreenshot("wordmark-night.png", { timeout: 10000 });
  });

  test("ambulance scene", async ({ page }) => {
    await gotoVisualPage(page, "/labs/city-logo?snapshot=1&timeOfDay=0.04&event=ambulance&voxelScale=3&detail=hd");
    const preview = page.getByTestId("city-logo-preview");
    await expect(preview).toBeVisible({ timeout: PREVIEW_TIMEOUT });
    await expect(preview).toHaveAttribute("data-snapshot-ready", "true", { timeout: PREVIEW_TIMEOUT });
    await expect(preview).toHaveScreenshot("wordmark-ambulance.png", { timeout: 10000 });
  });
});
