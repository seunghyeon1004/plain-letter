// Real-Chrome verification harness: one click to prepare, one to run, one to save.
import { installRecorder, ledgerEntries } from "./ledger/recorder";
installRecorder();
import "@fontsource/epilogue/400.css";
import "@fontsource/epilogue/600.css";
import "@fontsource/epilogue/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./ui/app.css";
import { initializeApp } from "firebase/app";
import { FirebaseLetterAI } from "./ai/firebase";
import { DEFAULT_CONFIG } from "./config/runtime";
import { SAMPLES } from "./samples/letters";
import { detectAll } from "./mask/detect";
import { mask } from "./mask/mask";
import { estimateTokens, guessLanguage } from "./route/language";
import { $ } from "./ui/dom";

// On-device calls never reach Firebase servers, so a placeholder project is enough here.
const app = initializeApp({ apiKey: "on-device-check", projectId: "on-device-check", appId: "1:0:web:0" }, "verify");
const ai = new FirebaseLetterAI(app, DEFAULT_CONFIG);
const logEl = $("#log");
const lines: string[] = [];
const log = (s: string) => {
  lines.push(s);
  logEl.textContent = lines.join("\n");
};

interface Check {
  id: string;
  kind: "explain" | "names" | "photo";
  sample: string;
  outputLang?: string;
  ok: boolean;
  ms: number;
  source?: string;
  output?: unknown;
  error?: string;
  sensitiveFoundByNames?: string[];
}

function letterImage(text: string): Promise<Blob> {
  const c = document.createElement("canvas");
  const ls = text.split("\n");
  c.width = 1000;
  c.height = 40 + ls.length * 26;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#111";
  g.font = "18px Georgia, serif";
  ls.forEach((l, i) => {
    // wrap long lines
    g.fillText(l.slice(0, 95), 30, 40 + i * 26);
  });
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

$("#prepare").addEventListener("click", async () => {
  log(`availability before: ${await ai.deviceState("en", "en")}`);
  try {
    await ai.prepareDevice((f) => (($("#progress") as HTMLProgressElement).value = Math.round(f * 100)));
    log(`availability after: ${await ai.deviceState("en", "en")}`);
  } catch (e) {
    log(`prepare failed: ${(e as Error).message}`);
  }
});

$("#run").addEventListener("click", async () => {
  const startNet = ledgerEntries().length;
  const checks: Check[] = [];
  const run = async (c: Omit<Check, "ok" | "ms">, f: () => Promise<{ out: unknown; source?: string }>) => {
    const t0 = performance.now();
    try {
      const { out, source } = await f();
      checks.push({ ...c, ok: true, ms: Math.round(performance.now() - t0), output: out, source });
      log(`ok   ${c.id} (${Math.round(performance.now() - t0)} ms)`);
    } catch (e) {
      checks.push({ ...c, ok: false, ms: Math.round(performance.now() - t0), error: `${(e as Error).name}: ${(e as Error).message}`, output: (e as { cause?: unknown }).cause });
      log(`FAIL ${c.id}: ${(e as Error).message}`);
    }
  };
  const short = SAMPLES.filter((s) => estimateTokens(s.text) < DEFAULT_CONFIG.deviceBudgetTokens);
  for (const s of short) {
    const lang = guessLanguage(s.text);
    for (const out of ["en", "es"]) {
      await run({ id: `explain:${s.id}:${out}`, kind: "explain", sample: s.id, outputLang: out }, async () => {
        const r = await ai.explainOnDevice(s.text, lang, out);
        return { out: r.explanation, source: r.source };
      });
    }
    await run({ id: `names:${s.id}`, kind: "names", sample: s.id }, async () => {
      const names = await ai.findNamesOnDevice(s.text, lang);
      const masked = mask(s.text, detectAll(s.text, names.map((value) => ({ value, type: "NAME" as const, source: "device" as const })))).masked;
      return { out: { names, leakedAfterMasking: s.sensitive.filter((x) => masked.includes(x)) }, source: "on_device" };
    });
  }
  await run({ id: "photo:rent", kind: "photo", sample: "rent" }, async () => {
    const text = await ai.transcribeOnDevice(await letterImage(SAMPLES[0]!.text));
    return { out: { text, chars: text.length }, source: "on_device" };
  });
  const net = ledgerEntries().slice(startNet);
  const result = {
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    brands: (navigator as unknown as { userAgentData?: { brands: unknown } }).userAgentData?.brands,
    deviceState: await ai.deviceState("en", "en"),
    networkRequestsDuringChecks: net.map((e) => `${e.method} ${e.host}${e.path}`),
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    checks,
  };
  log(`done: ${result.passed} ok, ${result.failed} failed, ${net.length} network requests`);
  (window as unknown as { __verify: unknown }).__verify = result;
  const a = $("#save") as HTMLAnchorElement;
  a.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
  a.hidden = false;
});
