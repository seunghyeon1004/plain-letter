// Real Google Chrome check of the on-device path. Run ONLY where launching
// Google Chrome is allowed:
//   node scripts/real-chrome-check.mjs [url]   (default: http://127.0.0.1:5191/verify.html after `npm run build && npm run preview`)
// It uses a dedicated profile in .chrome-profile/ (gitignored), so the person's
// own Chrome profile is never touched. The first run downloads the on-device
// model (several minutes). Results go to results/real-chrome-<time>.json.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.argv[2] ?? "http://127.0.0.1:5191/verify.html";
const ctx = await chromium.launchPersistentContext(".chrome-profile", { channel: "chrome", headless: false });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(url);
await page.click("#prepare");
await page.waitForFunction(() => /availability after|prepare failed/.test(document.querySelector("#log")?.textContent ?? ""), null, { timeout: 30 * 60_000 });
await page.click("#run");
await page.waitForFunction(() => (window).__verify, null, { timeout: 15 * 60_000 });
const result = await page.evaluate(() => (window).__verify);
mkdirSync("results", { recursive: true });
const file = `results/real-chrome-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(result, null, 2));
console.log(`${file}: ${result.passed} passed, ${result.failed} failed, network during checks: ${result.networkRequestsDuringChecks.length}`);
await ctx.close();
