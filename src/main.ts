// The recorder must be installed before Firebase loads, so it sees every request.
import { installRecorder, lastLedgerId, ledgerSince, onLedger, promptFromBody, watchFileLoads, type LedgerEntry } from "./ledger/recorder";
installRecorder();
watchFileLoads();

import "@fontsource/epilogue/400.css";
import "@fontsource/epilogue/600.css";
import "@fontsource/epilogue/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./ui/app.css";

import { boot, type Boot } from "./config/boot";
import { LetterAIError, type Explanation, type RunResult } from "./ai/types";
import { decideRoute, type DeviceState, type Route } from "./route/decide";
import { estimateTokens, guessLanguage, languageName, READER_LANGUAGES, deviceSupports } from "./route/language";
import { detectAll, valueSpans } from "./mask/detect";
import { mask, restore } from "./mask/mask";
import { ENTITY_LABEL, ENTITY_TYPES, type EntityType, type MaskResult, type Span } from "./mask/types";
import { extractLocal } from "./extract/deterministic";
import { SAMPLES } from "./samples/letters";
import { $, clear, h } from "./ui/dom";
import { answerLabels, isRtl } from "./ui/i18n";

const params = new URLSearchParams(location.search);
const bootP: Promise<Boot> = boot(params);

const els = {
  form: $("#letter-form") as HTMLFormElement,
  letter: $("#letter") as HTMLTextAreaElement,
  photo: $("#photo") as HTMLInputElement,
  photoField: $("#photo-field"),
  textField: $("#text-field"),
  photoHelp: $("#photo-help"),
  sample: $("#sample") as HTMLSelectElement,
  lang: $("#lang") as HTMLSelectElement,
  read: $("#read-btn") as HTMLButtonElement,
  clearBtn: $("#clear-btn") as HTMLButtonElement,
  answer: $("#answer"),
  devicePill: $("#device-pill"),
  netPill: $("#net-pill"),
  runs: $("#ledger-runs"),
  other: $("#ledger-other-list"),
  otherCount: $("#other-count"),
  ledgerSummary: $("#ledger-summary"),
};

// ---------- setup ----------

for (const s of SAMPLES) els.sample.append(h("option", { value: s.id }, `Sample: ${s.title}`));
for (const l of READER_LANGUAGES)
  els.lang.append(h("option", { value: l.code, lang: l.code }, l.label === l.english ? l.label : `${l.label} (${l.english})`));
els.lang.value = params.get("lang") ?? (READER_LANGUAGES.some((l) => l.code === navigator.language.slice(0, 2)) ? navigator.language.slice(0, 2) : "en");

els.sample.addEventListener("change", () => {
  const s = SAMPLES.find((x) => x.id === els.sample.value);
  if (!s) return;
  (document.getElementById("kind-text") as HTMLInputElement).checked = true;
  showKind("text");
  els.letter.value = s.text;
  els.letter.focus();
  schedulePreview();
});
els.clearBtn.addEventListener("click", () => {
  els.letter.value = "";
  els.sample.value = "";
  els.photo.value = "";
  renderEmpty();
  schedulePreview();
  els.letter.focus();
});
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="kind"]'))
  r.addEventListener("change", () => showKind(r.value as "text" | "photo"));
function showKind(k: "text" | "photo") {
  els.textField.hidden = k !== "text";
  els.photoField.hidden = k !== "photo";
}

// ---------- status pills ----------

let deviceState: DeviceState = "no-api";
let preparing: number | null = null;

function renderNet() {
  const on = navigator.onLine;
  els.netPill.textContent = on ? "Online" : "Offline";
  els.netPill.className = on ? "tag tag--out" : "tag tag--on";
}
addEventListener("online", renderNet);
addEventListener("offline", renderNet);
renderNet();

function renderDevicePill() {
  const p = els.devicePill;
  if (preparing !== null) {
    p.className = "tag tag--out";
    p.textContent = `Private reader: downloading ${Math.round(preparing * 100)}%`;
    return;
  }
  const text: Record<DeviceState, string> = {
    available: "Private reader: ready",
    downloadable: "Private reader: not downloaded",
    downloading: "Private reader: downloading",
    unavailable: "Private reader: not on this device",
    "no-api": "Private reader: not in this browser",
  };
  p.className = deviceState === "available" ? "tag tag--in" : "tag tag--out";
  p.textContent = text[deviceState];
}

async function refreshDevice(letterLang = "en", outputLang = els.lang.value) {
  const { ai } = await bootP;
  deviceState = await ai.deviceState(letterLang, deviceSupports(outputLang) ? outputLang : "en");
  renderDevicePill();
  return deviceState;
}

// ---------- path preview (what will happen before Read is pressed) ----------

const pathText = $("#path-text");
let previewTimer: number | undefined;

async function updatePreview() {
  const { cfg, mode } = await bootP;
  const text = els.letter.value.trim();
  const outputLang = els.lang.value;
  const letterLang = text ? guessLanguage(text) : "unknown";
  const device = await refreshDevice(letterLang === "unknown" ? "en" : letterLang, outputLang);
  const route = decideRoute({
    device,
    online: navigator.onLine,
    letterLang,
    outputLang,
    estTokens: text ? estimateTokens(text, cfg.charsPerToken) : 0,
    deviceBudgetTokens: cfg.deviceBudgetTokens,
  });
  const subject = text ? "This letter" : "A letter";
  let msg: string;
  if (route.path === "device") msg = `${subject} will be read on this device. Nothing will be sent.`;
  else if (route.path === "local-only") msg = `${subject} will stay on this device. No model is available right now, so you will get the dates, amounts and requests simple rules can find.`;
  else
    msg = `${subject} will not be read on this device: ${route.reasons[0]?.replace(/\.$/, "").replace(/^This /, "this ").replace(/^The /, "the ") ?? "the on-device model is not available"}. Plain Letter will hide your personal details first and show you the masked copy. Nothing is sent until you approve it.`;
  if (mode === "demo") msg += " (Demo mode: no AI model is used.)";
  pathText.textContent = msg;
  els.form.dataset.path = route.path;
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => void updatePreview(), 300);
}
els.letter.addEventListener("input", schedulePreview);
addEventListener("online", schedulePreview);
addEventListener("offline", schedulePreview);

const recording = document.getElementById("recording") as HTMLDialogElement;
$("#recording-btn").addEventListener("click", () => {
  recording.showModal();
  recording.querySelector("video")?.focus();
});
recording.addEventListener("close", () => recording.querySelector("video")?.pause());

// ---------- ledger ----------

interface Run {
  id: number;
  at: Date;
  title: string;
  path: "device" | "cloud-masked" | "local-only";
  startLedgerId: number;
  endLedgerId?: number;
  maskedCount?: number;
  /** response.inferenceSource of the answer shown, if any */
  inferenceSource?: string;
}
const runs: Run[] = [];
let allEntries: LedgerEntry[] = [];

function renderLedger() {
  const letterEntries = allEntries.filter((e) => e.kind === "letter");
  const other = allEntries.filter((e) => e.kind !== "letter");
  els.otherCount.textContent = String(other.length);
  clear(els.other, other.map((e) => entryRow(e)));
  const sent = letterEntries.length;
  els.ledgerSummary.textContent =
    runs.length === 0
      ? "Every request this page sends is listed here with its exact body, and every file it loads from another site by address."
      : `${runs.length} ${runs.length === 1 ? "reading" : "readings"} so far. ${sent === 0 ? "No letter text has left this device." : `${sent} ${sent === 1 ? "request" : "requests"} carried masked letter text, shown in full below.`}`;
  clear(
    els.runs,
    [...runs].reverse().map((r) => {
      const entries = allEntries.filter((e) => e.kind === "letter" && e.id > r.startLedgerId && (r.endLedgerId === undefined || e.id <= r.endLedgerId));
      const pill =
        r.path === "device"
          ? h("span", { class: "tag tag--in" }, "Stayed on this device")
          : r.path === "local-only"
            ? h("span", { class: "tag tag--in" }, "Stayed on this device")
            : r.endLedgerId === undefined
              ? h("span", { class: "tag tag--out" }, "Not sent yet")
              : entries.length
                ? h("span", { class: "tag tag--out" }, "Masked copy sent")
                : h("span", { class: "tag tag--in" }, "Nothing sent");
      return h(
        "li",
        { class: "run", "data-path": r.path },
        h("div", { class: "run__head" }, h("span", { class: "run__title" }, r.title), h("time", { class: "help", datetime: r.at.toISOString() }, r.at.toLocaleTimeString()), pill),
        entries.length === 0
          ? h("p", { class: "help" }, r.path === "cloud-masked" && r.endLedgerId === undefined ? "Waiting for your go-ahead. Nothing sent yet." : "Nothing was sent. 0 requests carried letter text.")
          : h("ol", { class: "run__entries" }, entries.map((e) => entryRow(e, true))),
      );
    }),
  );
}

function entryRow(e: LedgerEntry, open = false): HTMLElement {
  const prompt = e.kind === "letter" ? promptFromBody(e.body) : null;
  return h(
    "li",
    { class: "entry", "data-kind": e.kind },
    h(
      "details",
      { open },
      h(
        "summary",
        {},
        h("span", { class: "entry__what" }, `${e.method} ${e.host}${e.path}`),
        h("span", { class: "help num" }, e.status === undefined ? "sending" : e.status === 0 ? "failed" : `status ${e.status}`),
        h("span", { class: "help num" }, e.bodyShown ? `${new Blob([e.body]).size.toLocaleString("en")} bytes` : "token not shown"),
      ),
      prompt ? h("div", { class: "entry__body" }, h("p", { class: "label" }, "Text sent"), h("pre", { class: "code code--prompt" }, prompt)) : null,
      h(
        "div",
        { class: "entry__body" },
        h("p", { class: "label" }, e.bodyShown ? "Exact request body" : "Request body"),
        h("pre", { class: "code", "data-testid": e.kind === "letter" ? "ledger-body" : undefined }, e.body || "(empty)"),
      ),
    ),
  );
}

onLedger((entries) => {
  allEntries = entries;
  renderLedger();
});

// ---------- answer views ----------

function setBusy(b: boolean) {
  els.answer.setAttribute("aria-busy", String(b));
  els.read.disabled = b;
  els.read.setAttribute("aria-busy", String(b));
}

function renderEmpty() {
  clear(els.answer, h("p", { class: "empty" }, "Paste a letter or pick a sample. The answer appears here, with where it was read."));
}

function renderWorking(message: string) {
  clear(
    els.answer,
    h("p", { class: "working" }, message),
    h(
      "dl",
      { class: "explain explain--skeleton", "aria-hidden": "true" },
      ["What this is", "What you must do", "By when", "If you do nothing"].flatMap((t) => [h("dt", {}, t), h("dd", {}, h("span", { class: "skel" }))]),
    ),
  );
}

function reasonsList(route: Route) {
  return route.reasons.length ? h("ul", { class: "reasons" }, route.reasons.map((r) => h("li", {}, r))) : null;
}

function renderResult(e: Explanation, run: RunResult, route: Route, outputLang: string, notes: string[] = []) {
  const onDevice = run.source === "on_device";
  const t = answerLabels(outputLang);
  clear(
    els.answer,
    h(
      "div",
      { class: "verdict" },
      h("span", { class: onDevice ? "tag tag--in" : "tag tag--out", "data-testid": "source-pill" }, onDevice ? "Read on this device" : "Read in the cloud, masked"),
      h("span", { class: "help num" }, `${(run.ms / 1000).toFixed(1)} s`),
    ),
    h(
      "dl",
      { class: "explain", lang: outputLang, dir: isRtl(outputLang) ? "rtl" : undefined },
      h("dt", {}, t.what),
      h("dd", {}, e.what_this_is),
      h("dt", {}, t.must),
      h("dd", {}, e.what_you_must_do),
      h("dt", {}, t.when),
      h("dd", { class: "explain__when" }, e.by_when),
      h("dt", {}, t.nothing),
      h("dd", {}, e.if_you_do_nothing),
    ),
    e.questions_to_ask.length
      ? h("div", { class: "questions", lang: outputLang, dir: isRtl(outputLang) ? "rtl" : undefined }, h("h3", {}, t.questions), h("ul", {}, e.questions_to_ask.map((q) => h("li", {}, q))))
      : null,
    h("p", { class: "help", lang: outputLang, dir: isRtl(outputLang) ? "rtl" : undefined }, t.advice),
    notes.length ? h("ul", { class: "reasons" }, notes.map((n) => h("li", {}, n))) : null,
    !onDevice ? h("details", { class: "why-route" }, h("summary", {}, "Why it went to the cloud"), reasonsList(route)) : null,
  );
}

function renderLocal(text: string, route: Route) {
  const f = extractLocal(text);
  clear(
    els.answer,
    h("div", { class: "verdict" }, h("span", { class: "tag tag--in" }, "Stayed on this device"), h("span", { class: "help" }, "No model was used")),
    h("p", {}, "No model can read this letter right now, so here are the lines simple rules picked out. Check them against the letter."),
    reasonsList(route),
    h(
      "dl",
      { class: "explain" },
      h("dt", {}, "Dates with a deadline"),
      h("dd", {}, f.deadlines.length ? h("ul", {}, f.deadlines.map((d) => h("li", {}, d))) : "None found."),
      h("dt", {}, "Amounts"),
      h("dd", { class: "num" }, f.amounts.length ? f.amounts.join(", ") : "None found."),
      h("dt", {}, "Things it asks you to do"),
      h("dd", {}, f.requests.length ? h("ul", {}, f.requests.map((d) => h("li", {}, d))) : "None found."),
    ),
    route.deviceAfterDownload ? prepareBlock("Prepare the private reader while you are online, and next time this letter is read in full on this device.") : null,
  );
}

const FAILURE_TEXT: Record<string, { title: string; body: string }> = {
  quota: { title: "The cloud model is busy", body: "The free daily allowance for cloud readings is used up, or too many requests came at once. Nothing else was sent. Try again in a minute, or read a shorter letter on this device." },
  "app-check": { title: "This copy of the app could not prove it is genuine", body: "The cloud refused the request before reading it (App Check). Reload the page and try again." },
  offline: { title: "You are offline", body: "The masked copy was not sent. Connect to the internet and send it again, or use the on-device reader." },
  "cloud-error": { title: "The cloud model did not answer", body: "Something went wrong on the way. The masked copy may have been sent; the ledger below shows exactly what was. Try again." },
  "device-unavailable": { title: "The on-device model is not ready", body: "Prepare the private reader, or let Plain Letter hide your details and use the cloud." },
  "device-wrong-language": { title: "The on-device model answered in the wrong language", body: "Its answer was not shown. You can send a masked copy to the cloud instead." },
  "device-bad-output": { title: "The on-device model gave an unusable answer", body: "You can try again, or send a masked copy to the cloud instead." },
  "device-too-long": { title: "Too long for the on-device model", body: "Plain Letter can hide your details and send a masked copy instead." },
  "privacy-invariant": { title: "Stopped to protect your letter", body: "The reading did not happen where Plain Letter expected, so it stopped. Nothing else was done." },
};

function renderError(err: unknown, retry?: () => void, alt?: { label: string; run: () => void }) {
  const kind = err instanceof LetterAIError ? err.kind : "cloud-error";
  const t = FAILURE_TEXT[kind] ?? FAILURE_TEXT["cloud-error"]!;
  clear(
    els.answer,
    h(
      "div",
      { class: "notice", role: "alert", "data-error": kind },
      h("h3", {}, t.title),
      h("p", {}, t.body),
      h(
        "div",
        { class: "actions" },
        retry ? h("button", { class: "btn btn--primary", type: "button", onclick: retry }, "Try again") : null,
        alt ? h("button", { class: "btn btn--quiet", type: "button", onclick: alt.run }, alt.label) : null,
      ),
    ),
  );
}

function prepareBlock(message: string) {
  const progress = h("progress", { max: 100, value: 0, "aria-label": "Download of the on-device model" });
  const status = h("p", { class: "help", "aria-live": "polite" }, "");
  const btn = h("button", { class: "btn btn--quiet", type: "button" }, "Prepare the private reader");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const { ai } = await bootP;
    preparing = 0;
    renderDevicePill();
    status.textContent = "Downloading. This happens once and can take several minutes; you can keep using the page.";
    try {
      await ai.prepareDevice((f) => {
        preparing = f;
        (progress as HTMLProgressElement).value = Math.round(f * 100);
        renderDevicePill();
      });
      preparing = null;
      await refreshDevice();
      schedulePreview();
      status.textContent = deviceState === "available" ? "Ready. Read the letter again and it stays on this device." : "The download did not finish. Try again later.";
    } catch {
      preparing = null;
      renderDevicePill();
      status.textContent = "This browser could not download the on-device model.";
      btn.disabled = false;
    }
  });
  return h("div", { class: "prepare well" }, h("p", {}, message), btn, progress, status);
}

// ---------- review (masked copy) ----------

interface ReviewState {
  text: string;
  spans: Span[];
  hiddenKeys: Set<string>; // type + value pairs the user keeps hidden
  route: Route;
  outputLang: string;
  usedDeviceNames: boolean;
}

const keyOf = (type: EntityType, value: string) => `${type}\u0000${value}`;

function currentMask(r: ReviewState): MaskResult {
  return mask(r.text, r.spans.filter((s) => r.hiddenKeys.has(keyOf(s.type, r.text.slice(s.start, s.end)))));
}

function renderMaskedText(masked: string, m: MaskResult): HTMLElement {
  const tokens = Object.keys(m.map);
  const pre = h("pre", { class: "code code--masked", "data-testid": "masked-preview", tabindex: 0, "aria-label": "The masked copy that would be sent" });
  if (tokens.length === 0) {
    pre.textContent = masked;
    return pre;
  }
  const re = new RegExp(tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  let last = 0;
  for (const mm of masked.matchAll(re)) {
    pre.append(masked.slice(last, mm.index));
    pre.append(h("mark", { class: "token" }, mm[0]));
    last = mm.index! + mm[0].length;
  }
  pre.append(masked.slice(last));
  return pre;
}

function renderReview(r: ReviewState) {
  const m = currentMask(r);
  const allValues = new Map<string, { type: EntityType; value: string; source: Span["source"] }>();
  for (const s of r.spans) {
    const value = r.text.slice(s.start, s.end);
    const k = keyOf(s.type, value);
    if (!allValues.has(k)) allValues.set(k, { type: s.type, value, source: s.source });
  }
  const typeSel = h("select", { id: "add-type", "aria-label": "Kind of detail" }, ENTITY_TYPES.map((t) => h("option", { value: t }, ENTITY_LABEL[t])));
  const addInput = h("input", { id: "add-value", type: "text", autocomplete: "off", "aria-describedby": "add-help" });
  const tokenFor = (k: string) => m.entries.find((e) => keyOf(e.type, e.value) === k)?.token;

  clear(
    els.answer,
    h("div", { class: "verdict" }, h("span", { class: "tag tag--out" }, "Not sent yet"), h("span", { class: "help" }, "Check the masked copy")),
    h("p", {}, "This letter cannot be read on this device. Plain Letter hid your personal details here first. Only the copy below would go to the cloud model."),
    reasonsList(r.route),
    h("p", { class: "help" }, r.usedDeviceNames ? "Found by the on-device model and by fixed patterns." : "Found by fixed patterns only (no on-device model here). Check the names carefully."),
    h(
      "fieldset",
      { class: "hidden-items" },
      h("legend", { class: "label" }, `Hidden details (${m.entries.length})`),
      h(
        "p",
        { class: "help policy" },
        "Hidden: names of people, home addresses, dates of birth, account, case and reference numbers, phone numbers and email addresses. Kept: the name of the organisation that sent the letter, deadlines and amounts, because the answer depends on them.",
      ),
      allValues.size === 0 ? h("p", { class: "help" }, "Nothing was found to hide. Add anything personal below.") : null,
      h(
        "ul",
        { class: "ruled" },
        [...allValues.entries()].map(([k, v]) => {
          const id = `hide-${btoa(unescape(encodeURIComponent(k))).replace(/[^a-z0-9]/gi, "")}`;
          const cb = h("input", { type: "checkbox", id, checked: r.hiddenKeys.has(k) });
          cb.addEventListener("change", () => {
            if ((cb as HTMLInputElement).checked) r.hiddenKeys.add(k);
            else r.hiddenKeys.delete(k);
            renderReview(r);
            (document.getElementById(id) as HTMLInputElement | null)?.focus();
          });
          return h(
            "li",
            { class: "hidden-item" },
            cb,
            h("label", { for: id }, h("span", { class: "hidden-item__value" }, v.value), h("span", { class: "help" }, `${ENTITY_LABEL[v.type]}${v.source === "device" ? ", found on device" : v.source === "user" ? ", added by you" : ""}`)),
            h("span", { class: "help num" }, r.hiddenKeys.has(k) ? (tokenFor(k) ?? "inside another hidden detail") : "will be sent"),
          );
        }),
      ),
    ),
    h(
      "form",
      {
        class: "add-hide",
        onsubmit: (ev: Event) => {
          ev.preventDefault();
          const value = (addInput as HTMLInputElement).value.trim();
          const type = (typeSel as HTMLSelectElement).value as EntityType;
          const help = document.getElementById("add-help");
          if (!value || !r.text.includes(value)) {
            if (help) help.textContent = value ? "That exact text is not in the letter." : "Type the text to hide, exactly as in the letter.";
            (addInput as HTMLInputElement).focus();
            return;
          }
          r.spans.push(...valueSpans(r.text, [{ value, type, source: "user" }]));
          r.hiddenKeys.add(keyOf(type, value));
          renderReview(r);
          document.getElementById("add-value")?.focus();
        },
      },
      h("label", { class: "label", for: "add-value" }, "Hide something else"),
      h("div", { class: "add-hide__row" }, addInput, typeSel, h("button", { class: "btn btn--quiet", type: "submit" }, "Hide it")),
      h("p", { class: "help", id: "add-help" }, "Type it exactly as it appears in the letter."),
    ),
    h("p", { class: "label" }, "The copy that would be sent"),
    renderMaskedText(m.masked, m),
    h(
      "div",
      { class: "actions" },
      h("button", { class: "btn btn--primary", type: "button", id: "send-btn", onclick: () => void sendMasked(r) }, "Send this masked copy"),
      h("button", { class: "btn btn--quiet", type: "button", onclick: () => cancelReview() }, "Do not send"),
    ),
    r.route.deviceAfterDownload ? prepareBlock("Or keep it all on this device: download the private reader once, then read this letter again.") : null,
  );
}

let pendingRun: Run | null = null;

function cancelReview() {
  if (pendingRun) {
    pendingRun.endLedgerId = lastLedgerId();
    pendingRun.title += " (cancelled)";
    pendingRun = null;
    renderLedger();
  }
  clear(els.answer, h("p", { class: "empty" }, "Nothing was sent. The letter is still only on this device."));
}

async function sendMasked(r: ReviewState) {
  const { ai } = await bootP;
  const m = currentMask(r);
  const run = pendingRun ?? startRun("cloud-masked", r.text);
  pendingRun = null;
  run.startLedgerId = lastLedgerId();
  run.maskedCount = m.entries.length;
  setBusy(true);
  renderWorking("Sending the masked copy to the cloud model");
  try {
    const res = await ai.explainInCloud(m.masked, r.outputLang);
    run.endLedgerId = lastLedgerId();
    run.inferenceSource = res.source;
    const e = res.explanation;
    const back = (s: string) => restore(s, m.map);
    renderResult(
      { what_this_is: back(e.what_this_is), what_you_must_do: back(e.what_you_must_do), by_when: back(e.by_when), if_you_do_nothing: back(e.if_you_do_nothing), questions_to_ask: e.questions_to_ask.map(back) },
      res,
      r.route,
      r.outputLang,
      [`${m.entries.length} personal ${m.entries.length === 1 ? "detail was" : "details were"} hidden before sending and put back here, on this device.`],
    );
  } catch (err) {
    run.endLedgerId = lastLedgerId();
    renderError(err, () => {
      pendingRun = startRun("cloud-masked", r.text);
      renderReview(r);
    });
  } finally {
    setBusy(false);
    renderLedger();
  }
}

// ---------- reading ----------

function startRun(path: Run["path"], text: string): Run {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && !/^(SAMPLE|MUSTERBRIEF)/i.test(l)) ?? "Letter";
  const run: Run = { id: runs.length + 1, at: new Date(), title: firstLine.slice(0, 60), path, startLedgerId: lastLedgerId() };
  runs.push(run);
  renderLedger();
  return run;
}

async function read(text: string) {
  const { ai, cfg } = await bootP;
  const outputLang = els.lang.value;
  const letterLang = guessLanguage(text);
  const device = await refreshDevice(letterLang, outputLang);
  const route = decideRoute({
    device,
    online: navigator.onLine,
    letterLang,
    outputLang,
    estTokens: estimateTokens(text, cfg.charsPerToken),
    deviceBudgetTokens: cfg.deviceBudgetTokens,
  });
  if (route.path === "device") return readOnDevice(text, letterLang, outputLang, route);
  if (route.path === "local-only") {
    const run = startRun("local-only", text);
    run.endLedgerId = lastLedgerId();
    renderLocal(text, route);
    renderLedger();
    return;
  }
  return prepareMasked(text, letterLang, outputLang, route);
}

async function readOnDevice(text: string, letterLang: string, outputLang: string, route: Route) {
  const { ai } = await bootP;
  const run = startRun("device", text);
  setBusy(true);
  renderWorking("Reading on this device. The first reading can take up to 20 seconds.");
  try {
    const res = await ai.explainOnDevice(text, letterLang, outputLang);
    run.endLedgerId = lastLedgerId();
    run.inferenceSource = res.source;
    renderResult(res.explanation, res, route, outputLang);
  } catch (err) {
    run.endLedgerId = lastLedgerId();
    run.title += " (on-device answer not used)";
    const kind = err instanceof LetterAIError ? err.kind : "";
    const why =
      kind === "device-wrong-language"
        ? `The on-device model answered in the wrong language, so its answer was not shown.`
        : kind === "device-bad-output"
          ? "The on-device model did not give a complete answer, so it was not shown."
          : kind === "device-too-long"
            ? "The letter turned out too long for the on-device model."
            : "";
    const fallback = { ...route, path: "cloud-masked" as const, reasons: [...route.reasons.filter((x) => !x.startsWith("Read on")), why || (err as Error).message] };
    if (why && navigator.onLine) {
      // A weak on-device answer is never shown: go to the masked review instead (nothing is sent until the user confirms).
      setBusy(false);
      renderLedger();
      return await prepareMasked(text, letterLang, outputLang, fallback);
    }
    renderError(err, () => void readOnDevice(text, letterLang, outputLang, route), navigator.onLine ? { label: "Hide my details and use the cloud", run: () => void prepareMasked(text, letterLang, outputLang, fallback) } : undefined);
  } finally {
    setBusy(false);
    renderLedger();
  }
}

async function prepareMasked(text: string, letterLang: string, outputLang: string, route: Route) {
  const { ai } = await bootP;
  setBusy(true);
  renderWorking(route.masker === "device+patterns" ? "Finding personal details on this device" : "Finding personal details with fixed patterns");
  let names: string[] = [];
  if (route.masker === "device+patterns") {
    try {
      names = await ai.findNamesOnDevice(text, letterLang);
    } catch {
      names = [];
    }
  }
  const spans = detectAll(text, names.map((value) => ({ value, type: "NAME" as const, source: "device" as const })));
  const hiddenKeys = new Set(spans.map((s) => keyOf(s.type, text.slice(s.start, s.end))));
  pendingRun = startRun("cloud-masked", text);
  setBusy(false);
  renderReview({ text, spans, hiddenKeys, route, outputLang, usedDeviceNames: route.masker === "device+patterns" });
  document.getElementById("send-btn")?.focus();
}

// ---------- photo ----------

els.photo.addEventListener("change", async () => {
  const file = els.photo.files?.[0];
  if (!file) return;
  const { ai } = await bootP;
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    els.photoHelp.textContent = "Please choose a JPEG or PNG photo.";
    return;
  }
  const useText = (text: string, how: string) => {
    els.letter.value = text;
    (document.getElementById("kind-text") as HTMLInputElement).checked = true;
    showKind("text");
    (document.getElementById("letter-help") as HTMLElement).textContent = `${how} Check the text against the photo, then press Read this letter.`;
    els.letter.focus();
  };
  const state = await ai.deviceState("unknown", "en", true);
  if (state === "available") {
    els.photoHelp.textContent = "Reading the photo with the on-device model";
    try {
      const text = await ai.transcribeOnDevice(file);
      if (!text) throw new Error("empty");
      return useText(text, "Read from your photo by the on-device model.");
    } catch {
      // fall through to local text recognition
    }
  }
  offerLocalOcr(file, useText);
});

/** The photo never goes to the cloud: without a working on-device model, offer local text recognition (no AI). */
function offerLocalOcr(file: File, useText: (text: string, how: string) => void) {
  const help = els.photoHelp;
  const btn = h("button", { class: "btn btn--quiet", type: "button", id: "ocr-btn" }, "Read the photo here, without AI");
  clear(
    help,
    "There is no on-device model to read this photo, and it will not be uploaded. Plain Letter can read the text with simple text recognition in this browser (about 7 MB, downloaded once from this site), or you can type or paste the text.",
  );
  help.after(btn);
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    help.textContent = "Reading the text in your photo, in this browser";
    try {
      const { recognizeLocally } = await import("./ocr/local");
      const text = await recognizeLocally(file, (f) => (help.textContent = `Reading the text in your photo, in this browser: ${Math.round(f * 100)}%`));
      btn.remove();
      if (!text) throw new Error("empty");
      useText(text, "Read from your photo by text recognition in this browser.");
      help.textContent = "The photo was read in this browser and not uploaded.";
    } catch {
      btn.disabled = false;
      help.textContent = "The text could not be read from this photo. Please type or paste it instead.";
    }
  });
}

// ---------- submit ----------

els.form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const text = els.letter.value.trim();
  if (!text) {
    (document.getElementById("letter-help") as HTMLElement).textContent = "Paste a letter first, or choose a sample.";
    showKind("text");
    els.letter.focus();
    return;
  }
  pendingRun = null;
  void read(text).catch((err) => {
    setBusy(false);
    renderError(err);
  });
});

els.lang.addEventListener("change", schedulePreview);

// ---------- start ----------

bootP
  .then(async (b) => {
    document.documentElement.dataset.mode = b.mode;
    if (b.mode === "demo") {
      document.querySelector(".intro")?.append(h("p", { class: "notice notice--demo", role: "note" }, `Demo mode: answers come from simple rules, not an AI model. ${b.note ?? ""}`));
    }
    await updatePreview();
    if (deviceState === "downloadable" || deviceState === "downloading") {
      const slot = document.querySelector(".pane--letter");
      slot?.append(prepareBlock("Read letters fully offline: download the private reader once (a few minutes, on Wi-Fi)."));
    }
  })
  .catch(() => {
    els.devicePill.textContent = "Could not start";
  });

// Test hook: lets end-to-end tests read state without scraping text.
(window as unknown as { __plainLetter: object }).__plainLetter = { runs, entries: () => allEntries };
void ledgerSince;
