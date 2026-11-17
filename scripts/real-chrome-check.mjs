// Real Google Chrome check of the on-device path. Run ONLY where launching
// Google Chrome is allowed:
//   node scripts/real-chrome-check.mjs [url]   (default: http://127.0.0.1:5191/verify.html after `npm run build && npm run preview`)
// It uses a dedicated profile in .chrome-profile/ (gitignored), so the person's
// own Chrome profile is never touched. The first run downloads the on-device
// model (several minutes). Results go to results/real-chrome-<time>.json.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.argv[2] ?? "http://127.0.0.1:5191/verify.html";
// Playwright's defaults switch off component updates, background networking and
// optimization hints, which the on-device model needs; drop exactly those.
const PW_DISABLED = "AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion";
const ctx = await chromium.launchPersistentContext(".chrome-profile", {
  channel: "chrome",
  headless: false,
  ignoreDefaultArgs: ["--disable-component-update", "--disable-background-networking", "--disable-field-trial-config", `--disable-features=${PW_DISABLED}`],
  args: [`--disable-features=${PW_DISABLED.replace("OptimizationHints,", "")}`],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("console", (m) => { if (/LanguageModel|on-device|Built-In AI|model/i.test(m.text())) console.log("console:", m.text().slice(0, 200)); });
await page.goto(url);
console.log("chrome:", await page.evaluate(() => navigator.userAgent), "availability:", await page.evaluate(async () => (typeof LanguageModel === "function" ? await LanguageModel.availability() : "no LanguageModel")));
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
