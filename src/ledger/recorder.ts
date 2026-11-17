/**
 * "What left this device": records every outgoing request made with fetch()
 * from this page, with its exact body. Installed before Firebase starts, so
 * the cloud request made by Firebase AI Logic is captured byte for byte.
 */
export interface LedgerEntry {
  id: number;
  at: Date;
  method: string;
  host: string;
  path: string;
  kind: "letter" | "app-check" | "config" | "other" | "file";
  /** Exact request body as sent, or a note when it is not shown. */
  body: string;
  bodyShown: boolean;
  status?: number;
}

type Listener = (entries: LedgerEntry[]) => void;

const entries: LedgerEntry[] = [];
const listeners = new Set<Listener>();
let nextId = 1;
let installed = false;

function classify(url: URL): LedgerEntry["kind"] {
  if (url.hostname.includes("firebaseappcheck") || url.pathname.includes("exchangeDebugToken") || url.hostname.includes("recaptcha"))
    return "app-check";
  if (url.hostname.includes("firebaseremoteconfig") || url.hostname.includes("firebaseinstallations")) return "config";
  if (url.pathname.includes(":generateContent") || url.pathname.includes(":streamGenerateContent")) return "letter";
  return "other";
}

async function bodyText(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const b = init?.body;
  if (typeof b === "string") return b;
  if (b == null && input instanceof Request) return input.clone().text();
  if (b == null) return "";
  if (b instanceof Blob) return b.text();
  if (b instanceof URLSearchParams) return b.toString();
  if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) return new TextDecoder().decode(b as ArrayBuffer);
  return "[body not readable as text]";
}

function emit(): void {
  for (const l of listeners) l([...entries]);
}

export function installRecorder(win: Window & typeof globalThis = window): void {
  if (installed) return;
  installed = true;
  const original = win.fetch.bind(win);
  win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, win.location.href);
    // Same-origin assets and in-memory data: or blob: URLs never leave the device.
    if (url.origin === win.location.origin || !/^https?:$/.test(url.protocol)) return original(input, init);
    const kind = classify(url);
    const text = await bodyText(input, init);
    const entry: LedgerEntry = {
      id: nextId++,
      at: new Date(),
      method: (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
      host: url.host,
      path: url.pathname,
      kind,
      // App Check bodies carry attestation tokens; they never contain letter text, and are not shown.
      body: kind === "app-check" ? "App Check attestation (contains no letter text; not shown because it holds a token)" : text,
      bodyShown: kind !== "app-check",
    };
    entries.push(entry);
    emit();
    try {
      const res = await original(input, init);
      entry.status = res.status;
      emit();
      return res;
    } catch (e) {
      entry.status = 0;
      emit();
      throw e;
    }
  };
}

/**
 * Files the page loads from other sites (scripts, styles, images) do not go
 * through fetch. They carry no body; they are listed by address so the ledger
 * covers them too. Requests made inside third-party frames (the reCAPTCHA
 * frame) are not visible to this page.
 */
export function watchFileLoads(win: Window & typeof globalThis = window): void {
  if (!("PerformanceObserver" in win)) return;
  const seen = new Set<string>();
  const take = (list: PerformanceEntryList) => {
    for (const e of list as PerformanceResourceTiming[]) {
      if (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest") continue;
      let url: URL;
      try {
        url = new URL(e.name);
      } catch {
        continue;
      }
      if (url.origin === win.location.origin || !/^https?:$/.test(url.protocol) || seen.has(e.name)) continue;
      seen.add(e.name);
      entries.push({
        id: nextId++,
        at: new Date(),
        method: "GET",
        host: url.host,
        path: url.pathname,
        kind: "file",
        body: `File download (${e.initiatorType}); no request body.`,
        bodyShown: true,
        status: e.responseStatus || undefined,
      });
    }
    emit();
  };
  take(win.performance.getEntriesByType("resource"));
  new PerformanceObserver((l) => take(l.getEntries())).observe({ type: "resource", buffered: false });
}

export function onLedger(l: Listener): () => void {
  listeners.add(l);
  l([...entries]);
  return () => listeners.delete(l);
}

export function ledgerEntries(): LedgerEntry[] {
  return [...entries];
}

export function ledgerSince(id: number): LedgerEntry[] {
  return entries.filter((e) => e.id > id);
}

export function lastLedgerId(): number {
  return nextId - 1;
}

/** Extracts the prompt text from a generateContent body, for the readable view. */
export function promptFromBody(body: string): string | null {
  try {
    const o = JSON.parse(body) as { contents?: { parts?: { text?: string }[] }[] };
    return (o.contents ?? []).flatMap((c) => c.parts ?? []).map((p) => p.text ?? "").join("\n") || null;
  } catch {
    return null;
  }
}
