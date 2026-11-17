import type { FirebaseApp } from "firebase/app";
import {
  AIError,
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  Schema,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import type { RuntimeConfig } from "../config/runtime";
import type { DeviceState } from "../route/decide";
import { deviceSupports } from "../route/language";
import { chunk, EXPLANATION_JSON_SCHEMA, explainPrompt, NAMES_JSON_SCHEMA, namesPrompt, parseExplanation, parseNames, TRANSCRIBE_PROMPT } from "./prompt";
import { LetterAIError, type LetterAI, type RunResult, type Source } from "./types";

type LMExpected = { type: "text" | "image"; languages?: string[] };

declare const LanguageModel:
  | undefined
  | { availability(o?: { expectedInputs?: LMExpected[]; expectedOutputs?: LMExpected[] }): Promise<string> };

/** Cloud-side schema, built with the SDK's Schema helpers. */
const cloudSchema = Schema.object({
  properties: {
    what_this_is: Schema.string(),
    what_you_must_do: Schema.string(),
    by_when: Schema.string(),
    if_you_do_nothing: Schema.string(),
    questions_to_ask: Schema.array({ items: Schema.string() }),
  },
});

function deviceLangs(letterLang: string, outputLang: string): { inputs: string[]; outputs: string[] } {
  const inputs = ["en"]; // instructions are in English
  if (letterLang !== "unknown" && letterLang !== "en" && deviceSupports(letterLang)) inputs.push(letterLang);
  return { inputs, outputs: [deviceSupports(outputLang) ? outputLang : "en"] };
}

function createOptions(letterLang: string, outputLang: string, withImage: boolean) {
  const { inputs, outputs } = deviceLangs(letterLang, outputLang);
  const expectedInputs: LMExpected[] = [{ type: "text", languages: inputs }];
  if (withImage) expectedInputs.push({ type: "image" });
  return { expectedInputs, expectedOutputs: [{ type: "text" as const, languages: outputs }] };
}

/**
 * Firebase AI Logic implementation.
 *
 * Two kinds of GenerativeModel, never mixed:
 *  - ONLY_ON_DEVICE for anything that contains the raw letter (explain, find names, read a photo).
 *    If the device model is missing, the SDK throws instead of falling back to the cloud.
 *  - ONLY_IN_CLOUD for the masked letter, after the user has reviewed it.
 * PREFER_ON_DEVICE is deliberately not used: it would send the raw letter to the
 * cloud whenever the on-device model is unavailable or still downloading.
 */
export class FirebaseLetterAI implements LetterAI {
  readonly label = "Firebase AI Logic";
  private readonly ai: AI;
  private readonly deviceModels = new Map<string, GenerativeModel>();
  private cloud?: GenerativeModel;

  constructor(
    app: FirebaseApp,
    private readonly cfg: RuntimeConfig,
  ) {
    this.ai = getAI(app, { backend: new GoogleAIBackend() });
  }

  private deviceModel(kind: "explain" | "names" | "image", letterLang: string, outputLang: string): GenerativeModel {
    const key = `${kind}:${letterLang}:${outputLang}`;
    let m = this.deviceModels.get(key);
    if (!m) {
      const responseConstraint = kind === "explain" ? EXPLANATION_JSON_SCHEMA : kind === "names" ? NAMES_JSON_SCHEMA : undefined;
      m = getGenerativeModel(this.ai, {
        mode: InferenceMode.ONLY_ON_DEVICE,
        onDeviceParams: {
          createOptions: createOptions(letterLang, outputLang, kind === "image"),
          ...(responseConstraint ? { promptOptions: { responseConstraint } } : {}),
        },
      });
      this.deviceModels.set(key, m);
    }
    return m;
  }

  private cloudModel(): GenerativeModel {
    this.cloud ??= getGenerativeModel(this.ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: this.cfg.cloudModel,
        generationConfig: { responseMimeType: "application/json", responseSchema: cloudSchema, temperature: 0.2 },
      },
    });
    return this.cloud;
  }

  async deviceState(letterLang: string, outputLang: string, withImage = false): Promise<DeviceState> {
    if (typeof LanguageModel === "undefined") return "no-api";
    try {
      return (await LanguageModel.availability(createOptions(letterLang, outputLang, withImage))) as DeviceState;
    } catch {
      return "unavailable";
    }
  }

  async prepareDevice(onProgress: (fraction: number) => void): Promise<void> {
    await this.deviceModel("explain", "en", "en").initializeDeviceModel(onProgress);
  }

  private async run(model: GenerativeModel, request: Parameters<GenerativeModel["generateContent"]>[0], expect: Source) {
    const t0 = performance.now();
    let result;
    try {
      result = await model.generateContent(request);
    } catch (e) {
      throw toLetterError(e, expect);
    }
    const source = result.response.inferenceSource;
    // Privacy invariant: raw text must have been handled on the device.
    if (expect === "on_device" && source !== InferenceSource.ON_DEVICE)
      throw new LetterAIError("privacy-invariant", `Expected on-device inference, got ${String(source)}`);
    return { text: result.response.text(), source: (source ?? expect) as Source, ms: Math.round(performance.now() - t0) };
  }

  async explainOnDevice(letter: string, letterLang: string, outputLang: string): Promise<RunResult> {
    const r = await this.run(this.deviceModel("explain", letterLang, outputLang), explainPrompt(letter, outputLang, false), "on_device");
    try {
      return { explanation: parseExplanation(r.text), source: r.source, ms: r.ms };
    } catch (e) {
      throw new LetterAIError("device-bad-output", "The on-device model did not return a usable answer.", { raw: r.text.slice(0, 800), parseError: String(e) });
    }
  }

  async explainInCloud(maskedLetter: string, outputLang: string): Promise<RunResult> {
    const r = await this.run(this.cloudModel(), explainPrompt(maskedLetter, outputLang, true), "in_cloud");
    try {
      return { explanation: parseExplanation(r.text), source: r.source, ms: r.ms };
    } catch (e) {
      throw new LetterAIError("cloud-error", "The cloud model did not return a usable answer.", e);
    }
  }

  async findNamesOnDevice(letter: string, letterLang: string): Promise<string[]> {
    const model = this.deviceModel("names", letterLang, "en");
    const found = new Set<string>();
    for (const part of chunk(letter, this.cfg.nameChunkChars)) {
      try {
        const r = await this.run(model, namesPrompt(part), "on_device");
        for (const n of parseNames(r.text, letter)) found.add(n);
      } catch (e) {
        if (e instanceof LetterAIError && e.kind === "privacy-invariant") throw e;
        // Name finding is a bonus on top of the patterns; a failed chunk is not fatal.
      }
    }
    return [...found];
  }

  async transcribeOnDevice(image: Blob): Promise<string> {
    const data = await blobToBase64(image);
    const r = await this.run(
      this.deviceModel("image", "unknown", "en"),
      [TRANSCRIBE_PROMPT, { type: "inlineData", inlineData: { data, mimeType: image.type } }],
      "on_device",
    );
    return r.text.trim();
  }
}

function toLetterError(e: unknown, expect: Source): LetterAIError {
  if (e instanceof LetterAIError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (e instanceof AIError) {
    const status = e.customErrorData?.status;
    if (expect === "on_device") {
      if (/QuotaExceeded|too large|context/i.test(msg)) return new LetterAIError("device-too-long", msg, e);
      return new LetterAIError("device-unavailable", msg, e);
    }
    if (status === 429) return new LetterAIError("quota", msg, e);
    if (status === 401 || status === 403 || /app.?check/i.test(msg)) return new LetterAIError("app-check", msg, e);
    if (e.code === "fetch-error" && !navigator.onLine) return new LetterAIError("offline", msg, e);
    return new LetterAIError("cloud-error", msg, e);
  }
  if (expect === "on_device") {
    if (e instanceof DOMException && e.name === "QuotaExceededError") return new LetterAIError("device-too-long", msg, e);
    return new LetterAIError("device-unavailable", msg, e);
  }
  if (!navigator.onLine) return new LetterAIError("offline", msg, e);
  return new LetterAIError("cloud-error", msg, e);
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
