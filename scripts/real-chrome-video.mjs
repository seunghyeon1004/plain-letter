// Records the demo segments in real Google Chrome (page-only video, never the screen).
// A labelled overlay shows Chrome's own network log, taken live from the DevTools
// Protocol (Network.requestWillBeSent), so the recording proves what left the page.
//   segment A: on-device read (rent letter, Spanish): network log stays at 0 requests
//   segment B: long letter -> masked review -> send: one request; the ledger shows the same body
// Rules: dedicated .chrome-profile/, no sign-in, only the app's pages, Chrome closed at the end.
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "https://plain-letter-hybrid.web.app";
const PW_DISABLED = "AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion";
mkdirSync("docs/video/raw", { recursive: true });

async function segment(name, run) {
  const ctx = await chromium.launchPersistentContext(".chrome-profile", {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: "docs/video/raw", size: { width: 1440, height: 900 } },
    ignoreDefaultArgs: ["--disable-component-update", "--disable-background-networking", "--disable-field-trial-config", `--disable-features=${PW_DISABLED}`],
    args: [`--disable-features=${PW_DISABLED.replace("OptimizationHints,", "")}`],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  const log = [];
  let counting = false;
  cdp.on("Network.requestWillBeSent", (e) => {
    const u = new URL(e.request.url);
    if (!counting || !/^https?:$/.test(u.protocol) || u.host === new URL(base).host) return;
    log.push(`${e.request.method} ${u.host}${u.pathname.length > 60 ? u.pathname.slice(0, 60) + "…" : u.pathname}`);
    void paint();
  });
  const paint = () =>
    page.evaluate((lines) => {
      let el = document.getElementById("rec-netlog");
      if (!el) {
        el = document.createElement("aside");
        el.id = "rec-netlog";
        el.setAttribute("aria-hidden", "true");
        el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;width:520px;max-height:210px;overflow:hidden;padding:12px 14px;border-radius:10px;background:#111;color:#f4f4f2;font:13px/1.45 'IBM Plex Mono',ui-monospace,monospace;box-shadow:0 12px 30px #0006";
        document.body.append(el);
      }
      const head = `Recording overlay: Chrome network log (DevTools Protocol)\nRequests to other sites since Read: ${lines.length}`;
      el.textContent = [head, ...lines.slice(-6)].join("\n");
      el.style.whiteSpace = "pre-wrap";
    }, log);
  const ctl = {
    page,
    startCounting: async () => { counting = true; log.length = 0; await paint(); },
    log,
  };
  const facts = await run(ctl);
  const v = page.video();
  await ctx.close();
  renameSync(await v.path(), `docs/video/${name}.webm`);
  return { ...facts, networkLog: [...log] };
}

const scrollTo = (page, sel, block = "start") => page.locator(sel).first().evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
const factsOf = (page) => page.evaluate(() => ({
  runs: window.__plainLetter.runs.map((r) => ({ path: r.path, inferenceSource: r.inferenceSource })),
  letterRequests: window.__plainLetter.entries().filter((e) => e.kind === "letter").map((e) => ({ url: e.host + e.path, status: e.status, bytes: new Blob([e.body]).size })),
}));

const A = await segment("A-on-device-read-network-log", async ({ page, startCounting }) => {
  await page.goto(`${base}/?lang=es&v=${Date.now()}`);
  await page.waitForFunction(() => /ready/.test(document.querySelector("#device-pill")?.textContent ?? ""), null, { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await page.selectOption("#sample", "rent");
  await page.waitForTimeout(2500);
  await startCounting();
  await page.click("#read-btn");
  await page.waitForSelector("[data-testid=source-pill], [data-error], [data-testid=masked-preview]", { timeout: 60_000 });
  await page.waitForTimeout(5000);
  await scrollTo(page, ".ledger");
  await page.waitForTimeout(4000);
  return factsOf(page);
});

const B = await segment("B-masked-cloud-ledger-equals-request", async ({ page, startCounting }) => {
  await page.goto(`${base}/?lang=en&v=${Date.now()}`);
  await page.waitForFunction(() => /Private reader/.test(document.querySelector("#device-pill")?.textContent ?? ""), null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.selectOption("#sample", "benefit");
  await page.waitForTimeout(2000);
  await startCounting();
  await page.click("#read-btn");
  await page.waitForSelector("#send-btn", { timeout: 60_000 });
  await scrollTo(page, ".pane--answer");
  await page.waitForTimeout(4000);
  await scrollTo(page, ".hidden-items");
  await page.waitForTimeout(4000);
  await scrollTo(page, "[data-testid=masked-preview]", "center");
  await page.waitForTimeout(3500);
  await page.click("#send-btn");
  await page.waitForSelector("[data-testid=source-pill], [data-error]", { timeout: 60_000 });
  await scrollTo(page, ".pane--answer");
  await page.waitForTimeout(4500);
  await scrollTo(page, "[data-testid=ledger-body]", "center");
  await page.waitForTimeout(5000);
  return factsOf(page);
});

const out = { at: new Date().toISOString(), A, B };
writeFileSync("docs/video/capture-facts.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
