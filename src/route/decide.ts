import { deviceSupports, languageName } from "./language";

/** What `LanguageModel.availability()` said, or "no-api" when the browser has no Prompt API. */
export type DeviceState = "available" | "downloadable" | "downloading" | "unavailable" | "no-api";

export interface RouteInput {
  device: DeviceState;
  online: boolean;
  letterLang: string; // guessed, or "unknown"
  outputLang: string;
  estTokens: number;
  deviceBudgetTokens: number; // input budget inside the 9216-token window
}

export type Path =
  /** Read on this device. The letter never leaves. */
  | "device"
  /** Personal details are hidden on the device, the user reviews the masked text, then only that goes to the cloud. */
  | "cloud-masked"
  /** No model at all (offline, no on-device model): deterministic extraction only. */
  | "local-only";

export interface Route {
  path: Path;
  /** Masking engine for the cloud path. */
  masker: "device+patterns" | "patterns";
  /** True when the on-device path would fit once the model is downloaded. */
  deviceAfterDownload: boolean;
  /** Plain-language reasons, shown to the user. */
  reasons: string[];
}

/**
 * The routing decision. Raw letter text only ever goes to the on-device
 * model. The cloud only ever receives masked text, after the user confirms.
 * This is why the app does not use PREFER_ON_DEVICE for raw text: with that
 * mode the SDK silently sends the request to the cloud whenever the device
 * model is missing or still downloading.
 */
export function decideRoute(i: RouteInput): Route {
  const reasons: string[] = [];
  const canRead = i.letterLang === "unknown" || deviceSupports(i.letterLang);
  const langOk = canRead && deviceSupports(i.outputLang);
  const sizeOk = i.estTokens <= i.deviceBudgetTokens;
  const ready = i.device === "available";
  const downloadable = i.device === "downloadable" || i.device === "downloading";

  if (!deviceSupports(i.outputLang)) reasons.push(`The on-device model cannot write ${languageName(i.outputLang)} yet.`);
  if (i.letterLang !== "unknown" && !deviceSupports(i.letterLang)) reasons.push(`The on-device model cannot read ${languageName(i.letterLang)} yet.`);
  if (!sizeOk) reasons.push(`This letter is too long for the on-device model (about ${i.estTokens.toLocaleString("en")} tokens; the limit here is ${i.deviceBudgetTokens.toLocaleString("en")}).`);
  if (i.device === "no-api") reasons.push("This browser has no on-device model.");
  if (i.device === "unavailable") reasons.push("The on-device model is not available on this device.");
  if (i.device === "downloadable") reasons.push("The on-device model is not downloaded yet.");
  if (i.device === "downloading") reasons.push("The on-device model is still downloading.");

  const deviceFits = langOk && sizeOk;
  const masker: Route["masker"] = ready && canRead ? "device+patterns" : "patterns";

  if (ready && deviceFits) {
    return { path: "device", masker, deviceAfterDownload: false, reasons: ["Read on this device. Nothing leaves it."] };
  }
  if (!i.online) {
    reasons.push("You are offline, so the cloud model cannot help right now.");
    return { path: "local-only", masker, deviceAfterDownload: downloadable && deviceFits, reasons };
  }
  return { path: "cloud-masked", masker, deviceAfterDownload: downloadable && deviceFits, reasons };
}
