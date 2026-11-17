// Captures docs/screens from the hosted app (real Firebase AI Logic, cloud path;
// Playwright's Chromium has no on-device model). Usage: node scripts/capture-screens.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "https://plain-letter-hybrid.web.app";
mkdirSync("docs/screens", { recursive: true });
const b = await chromium.launch({ headless: false });
for (const [name, vp, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, locale: "en-US" });
  const p = await ctx.newPage();
  await p.goto(`${base}/?lang=es`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `docs/screens/${name}-1-start.png` });
  await p.selectOption("#sample", "rent");
  await p.click("#read-btn");
  await p.waitForSelector("#send-btn");
  await p.locator(".pane--answer").scrollIntoViewIfNeeded();
  await p.screenshot({ path: `docs/screens/${name}-2-review-masked-copy.png`, fullPage: true });
  await p.click("#send-btn");
  await p.waitForSelector("[data-testid=source-pill], [data-error]", { timeout: 60000 });
  await p.locator(".pane--answer").scrollIntoViewIfNeeded();
  await p.screenshot({ path: `docs/screens/${name}-3-answer-cloud-masked.png` });
  await p.locator(".ledger").scrollIntoViewIfNeeded();
  await p.screenshot({ path: `docs/screens/${name}-4-ledger.png` });
  await p.screenshot({ path: `docs/screens/${name}-full.png`, fullPage: true });
  await ctx.close();
}
await b.close();
console.log("saved docs/screens");
