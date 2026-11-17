// Real Google Chrome pass of the product (on-device path) with a screen recording
// for the demo video. Same rules as real-chrome-check.mjs: dedicated .chrome-profile/.
//   node scripts/real-chrome-demo.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "https://plain-letter-hybrid.web.app";
const PW_DISABLED = "AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion";
mkdirSync("docs/video/raw", { recursive: true });
const ctx = await chromium.launchPersistentContext(".chrome-profile", {
  channel: "chrome",
  headless: false,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: "docs/video/raw", size: { width: 1440, height: 900 } },
  ignoreDefaultArgs: ["--disable-component-update", "--disable-background-networking", "--disable-field-trial-config", `--disable-features=${PW_DISABLED}`],
  args: [`--disable-features=${PW_DISABLED.replace("OptimizationHints,", "")}`],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const external = [];
page.on("request", (r) => { const u = new URL(r.url()); if (u.host !== new URL(base).host && /^https?:/.test(u.protocol)) external.push({ t: Date.now(), url: u.host + u.pathname }); });
await page.goto(`${base}/?lang=es&v=${Date.now()}`);
await page.waitForFunction(() => /ready/.test(document.querySelector("#device-pill")?.textContent ?? ""), null, { timeout: 60_000 });
await page.waitForTimeout(1500);
await page.selectOption("#sample", "rent");
await page.waitForTimeout(1200);
const before = Date.now();
await page.click("#read-btn");
await page.waitForSelector("[data-testid=source-pill], [data-error], [data-testid=masked-preview]", { timeout: 120_000 });
await page.locator(".pane--answer").scrollIntoViewIfNeeded();
await page.waitForTimeout(4000);
await page.locator(".ledger").scrollIntoViewIfNeeded();
await page.waitForTimeout(3000);
const result = {
  at: new Date().toISOString(),
  pill: await page.locator("[data-testid=source-pill]").textContent().catch(() => null),
  runs: await page.evaluate(() => window.__plainLetter.runs.map((r) => ({ path: r.path, title: r.title, inferenceSource: r.inferenceSource }))),
  answer: await page.locator("#answer").innerText(),
  externalRequestsDuringReading: external.filter((e) => e.t >= before).map((e) => e.url),
};
const v = page.video();
await ctx.close();
renameSync(await v.path(), "docs/video/03-04-on-device-read.webm");
mkdirSync("results", { recursive: true });
writeFileSync(`results/real-chrome-demo-${Date.now()}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
