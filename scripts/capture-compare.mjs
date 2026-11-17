// Builds the "naive PREFER_ON_DEVICE vs Plain Letter" comparison for the video from REAL
// request bodies: the same sample letter sent by (1) the tests/fixtures/naive.html page
// (one model, PREFER_ON_DEVICE, in a browser with no on-device model) and (2) Plain Letter.
// Both requests are intercepted and answered locally; nothing reaches Google.
// Needs the dev server: npx vite --port 5190
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";

const dev = "http://127.0.0.1:5190";
const sensitive = ["Maria Elena Okafor", "Okafor", "14 Larkspur Lane, Apt 3B", "Eastmere, OR 97998", "HPM-55120-3B", "(541) 555-0187", "(541) 555-0142", "leasing@harrowgate-pm.example", "Jordan Reyes"];
const answer = { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify({ what_this_is: "x", what_you_must_do: "x", by_when: "x", if_you_do_nothing: "x", questions_to_ask: [] }) }] }, finishReason: "STOP" }] };

const b = await chromium.launch();
const p = await b.newPage();
const bodies = [];
await p.route("https://content-firebaseappcheck.googleapis.com/**", (r) => r.fulfill({ json: { token: "local", ttl: "3600s" } }));
await p.route(/firebaseremoteconfig|firebaseinstallations|recaptcha|gstatic/, (r) => r.abort());
await p.route("https://firebasevertexai.googleapis.com/**", (r) => { bodies.push(r.request().postData() ?? ""); return r.fulfill({ json: answer }); });
await p.goto(`${dev}/tests/fixtures/naive.html`);
await p.waitForFunction(() => window.naiveReady);
const naiveSource = await p.evaluate(() => window.runNaive());
await p.goto(`${dev}/?lang=es`);
await p.waitForTimeout(1500);
await p.selectOption("#sample", "rent");
await p.click("#read-btn");
await p.click("#send-btn");
await p.waitForSelector("[data-testid=source-pill], [data-error]");
const promptOf = (body) => JSON.parse(body).contents.flatMap((c) => c.parts).map((x) => x.text).join("\n");
const naiveText = promptOf(bodies[0]);
const appText = promptOf(bodies[1]);
const leaksNaive = sensitive.filter((s) => naiveText.includes(s));
const leaksApp = sensitive.filter((s) => appText.includes(s));
console.log({ naiveSource, leaksNaive: leaksNaive.length, leaksApp: leaksApp.length });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const mark = (text) => {
  let h = esc(text.slice(text.indexOf("SAMPLE LETTER")).split("\n").slice(0, 22).join("\n"));
  for (const s of [...sensitive].sort((a, b) => b.length - a.length)) h = h.split(esc(s)).join(`<mark class="leak">${esc(s)}</mark>`);
  return h.replace(/\[(NAME|ADDRESS|IDNUM|PHONE|EMAIL|DOB)_\d+\]/g, (t) => `<mark class="tok">${t}</mark>`);
};
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Same letter, two hybrid apps</title>
<style>
:root{--paper:#fdfdfb;--ink:#151515;--ink2:#333;--rule:#dcdcd8;--soft:#c9f0ee;--softink:#163c3c;--well:#f4f4f1}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 Epilogue,system-ui,sans-serif}
.wrap{max-width:1360px;margin:0 auto;padding:36px 40px}
h1{font-size:34px;letter-spacing:-.03em;margin:0 0 6px}p.sub{margin:0 0 22px;color:var(--ink2)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.col h2{font-size:21px;margin:0 0 4px;letter-spacing:-.02em}.col .meta{font-size:14px;color:var(--ink2);margin:0 0 10px}
pre{margin:0;padding:14px 16px;background:var(--well);border:1px solid var(--rule);border-radius:12px;font:13px/1.5 'IBM Plex Mono',ui-monospace,monospace;white-space:pre-wrap;height:520px;overflow:hidden}
mark.leak{background:var(--ink);color:var(--paper);padding:0 3px;border-radius:3px}
mark.tok{background:var(--soft);color:var(--softink);padding:0 3px;border-radius:3px;font-weight:600}
.count{display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;font-weight:600}
.bad{background:var(--ink);color:var(--paper)}.good{background:var(--soft);color:var(--softink)}
.note{margin-top:18px;font-size:13px;color:var(--ink2)}
</style></head><body><div class="wrap">
<h1>Same letter. What reached the cloud?</h1>
<p class="sub">This browser has no on-device model. Both request bodies below were captured from real Firebase AI Logic calls, then answered locally.</p>
<div class="grid">
<section class="col"><h2>One model with <code>PREFER_ON_DEVICE</code></h2><p class="meta">The SDK fell back to the cloud on its own: <code>inferenceSource: ${naiveSource}</code></p>
<pre>${mark(naiveText)}</pre><span class="count bad">${leaksNaive.length} of ${sensitive.length} personal details sent</span></section>
<section class="col"><h2>Plain Letter</h2><p class="meta">Masked on this device, reviewed, then sent with <code>ONLY_IN_CLOUD</code></p>
<pre>${mark(appText)}</pre><span class="count good">${leaksApp.length} of ${sensitive.length} personal details sent</span></section>
</div>
<p class="note">Sample letter, invented for this demo. The full test is tests/e2e/naive.spec.ts in the repository.</p>
</div></body></html>`;
mkdirSync("docs/video", { recursive: true });
writeFileSync("docs/video/C-naive-vs-plain-letter.html", html);
await b.close();

const b2 = await chromium.launch();
const ctx = await b2.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: "docs/video/raw", size: { width: 1440, height: 900 } } });
const p2 = await ctx.newPage();
await p2.goto(`${dev}/docs/video/C-naive-vs-plain-letter.html`);
await p2.waitForTimeout(9000);
await p2.screenshot({ path: "docs/video/C-naive-vs-plain-letter.png" });
const v = p2.video();
await ctx.close();
renameSync(await v.path(), "docs/video/C-naive-vs-plain-letter.webm");
await b2.close();
writeFileSync("docs/video/C-facts.json", JSON.stringify({ naiveSource, leaksNaive, leaksApp, naiveBodyBytes: bodies[0].length, appBodyBytes: bodies[1].length }, null, 2));
console.log("saved docs/video/C-*");
