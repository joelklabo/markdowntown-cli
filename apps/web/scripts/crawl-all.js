#!/usr/bin/env node
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3000";
const pages = [
  "/", "/browse", "/templates", "/tags", "/docs", "/changelog", "/privacy", "/terms", "/signin",
  "/snippets/sys-tone", "/templates/agents-template-basic", "/files/agents-file-langs"
];
const WAIT = Number(process.env.CRAWL_WAIT_MS || 300);
const MAX = Number(process.env.CRAWL_MAX || 120);
const TIMEOUT = Number(process.env.CRAWL_TIMEOUT || 4000);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const path of pages) {
    const page = await browser.newPage();
    const url = base + path;
    const logs = [];
    const errors = [];
    page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
    page.on("pageerror", (err) => errors.push(err.message));
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const controls = [...await page.$$("a[href]"), ...await page.$$("button")].slice(0, MAX);
      for (const el of controls) {
        const tag = await el.evaluate((n) => n.tagName.toLowerCase());
        const label = await el.evaluate(
          (n) => n.innerText.trim() || n.getAttribute("aria-label") || ""
        );
        const href = tag === "a" ? await el.getAttribute("href") : null;
        if (href && href.startsWith("http") && !href.startsWith(base)) continue;
        try {
          await el.click({ timeout: TIMEOUT });
          await page.waitForTimeout(WAIT);
          if (page.url() !== url && href) {
            await page.goBack({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(WAIT);
          }
        } catch (err) {
          results.push({ page: path, control: `${tag}:${label}`, href, error: err.message });
          if (page.url() !== url) {
            await page.goto(url, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(WAIT);
          }
        }
      }
    } catch (err) {
      results.push({ page: path, control: "load", href: url, error: err.message });
    }
    results.push(...errors.map((msg) => ({ page: path, control: "pageerror", error: msg })));
    results.push(...logs.map((msg) => ({ page: path, control: "console", error: `${msg.type}: ${msg.text}` })));
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
