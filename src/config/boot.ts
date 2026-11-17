import { DEFAULT_CONFIG, REMOTE_CONFIG_KEYS, type RuntimeConfig } from "./runtime";
import { APPCHECK_DEBUG_TOKEN, FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from "./firebase";
import { FakeLetterAI } from "../ai/fake";
import type { LetterAI } from "../ai/types";

export interface Boot {
  ai: LetterAI;
  cfg: RuntimeConfig;
  mode: "firebase" | "demo";
  /** Resolves when Remote Config values are applied to `cfg` (or defaults are kept). */
  configReady: Promise<void>;
  /** Why demo mode, if it is. */
  note?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined;
}

/**
 * Starts Firebase (App, App Check, Remote Config, AI Logic), or the demo
 * stand-in when there is no Firebase config or `?ai=demo` is in the URL.
 */
export async function boot(params: URLSearchParams): Promise<Boot> {
  if (params.get("ai") === "demo" || !FIREBASE_CONFIG) {
    return {
      ai: FakeLetterAI.fromUrl(params),
      cfg: { ...DEFAULT_CONFIG },
      mode: "demo",
      configReady: Promise.resolve(),
      note: FIREBASE_CONFIG ? "Demo mode was requested in the address." : "No Firebase project is configured in this build.",
    };
  }
  const { initializeApp } = await import("firebase/app");
  const { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider } = await import("firebase/app-check");
  const app = initializeApp(FIREBASE_CONFIG);

  if (APPCHECK_DEBUG_TOKEN) self.FIREBASE_APPCHECK_DEBUG_TOKEN = APPCHECK_DEBUG_TOKEN;
  const provider = RECAPTCHA_SITE_KEY
    ? new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY)
    : // Debug-token-only builds (local development, tests) still need a provider object.
      new CustomProvider({ getToken: () => Promise.reject(new Error("No App Check provider configured")) });
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });

  // Remote Config loads in the background; the app starts with defaults and never waits on the network.
  const cfg: RuntimeConfig = { ...DEFAULT_CONFIG };
  const configReady = loadRemoteConfig(app, cfg);
  const { FirebaseLetterAI } = await import("../ai/firebase");
  return { ai: new FirebaseLetterAI(app, cfg), cfg, mode: "firebase", configReady };
}

async function loadRemoteConfig(app: import("firebase/app").FirebaseApp, cfg: RuntimeConfig): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const { getRemoteConfig, fetchAndActivate, getValue } = await import("firebase/remote-config");
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = 10 * 60 * 1000;
    rc.settings.fetchTimeoutMillis = 4000;
    rc.defaultConfig = {
      [REMOTE_CONFIG_KEYS.cloudModel]: DEFAULT_CONFIG.cloudModel,
      [REMOTE_CONFIG_KEYS.deviceBudgetTokens]: DEFAULT_CONFIG.deviceBudgetTokens,
      [REMOTE_CONFIG_KEYS.charsPerToken]: DEFAULT_CONFIG.charsPerToken,
      [REMOTE_CONFIG_KEYS.nameChunkChars]: DEFAULT_CONFIG.nameChunkChars,
    };
    await fetchAndActivate(rc);
    cfg.cloudModel = getValue(rc, REMOTE_CONFIG_KEYS.cloudModel).asString() || DEFAULT_CONFIG.cloudModel;
    cfg.deviceBudgetTokens = getValue(rc, REMOTE_CONFIG_KEYS.deviceBudgetTokens).asNumber() || DEFAULT_CONFIG.deviceBudgetTokens;
    cfg.charsPerToken = getValue(rc, REMOTE_CONFIG_KEYS.charsPerToken).asNumber() || DEFAULT_CONFIG.charsPerToken;
    cfg.nameChunkChars = getValue(rc, REMOTE_CONFIG_KEYS.nameChunkChars).asNumber() || DEFAULT_CONFIG.nameChunkChars;
  } catch {
    // Defaults are fine; Remote Config only tunes them.
  }
}
