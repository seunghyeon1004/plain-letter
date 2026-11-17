import { extractLocal } from "../extract/deterministic";
import type { DeviceState } from "../route/decide";
import { deviceSupports } from "../route/language";
import { LetterAIError, type Explanation, type LetterAI, type RunResult } from "./types";

export interface FakeOptions {
  device: DeviceState;
  cloud: "ok" | "quota" | "app-check" | "error";
  delayMs: number;
}

/**
 * Stand-in model for development and tests (no Firebase project needed).
 * Its answers come from simple rules, and the UI labels it "demo mode".
 */
export class FakeLetterAI implements LetterAI {
  readonly label = "Demo mode (rule-based stand-in, no AI model)";
  private state: DeviceState;

  constructor(private readonly o: FakeOptions) {
    this.state = o.device;
  }

  static fromUrl(params: URLSearchParams): FakeLetterAI {
    return new FakeLetterAI({
      device: (params.get("fakeDevice") as DeviceState) ?? "available",
      cloud: (params.get("fakeCloud") as FakeOptions["cloud"]) ?? "ok",
      delayMs: Number(params.get("fakeDelay") ?? 400),
    });
  }

  private wait(ms = this.o.delayMs) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async deviceState(letterLang: string, outputLang: string): Promise<DeviceState> {
    if (this.state !== "available") return this.state;
    return (letterLang === "unknown" || deviceSupports(letterLang)) && deviceSupports(outputLang) ? "available" : "unavailable";
  }

  async prepareDevice(onProgress: (f: number) => void): Promise<void> {
    if (this.state === "unavailable" || this.state === "no-api") throw new LetterAIError("device-unavailable", "No on-device model here.");
    this.state = "downloading";
    for (let i = 1; i <= 10; i++) {
      await this.wait(this.o.delayMs / 4);
      onProgress(i / 10);
    }
    this.state = "available";
  }

  private explain(text: string): Explanation {
    const f = extractLocal(text);
    return {
      what_this_is: `Demo answer: ${text.split("\n").find((l) => /notice|letter|erinnerung|decision|attendance/i.test(l))?.trim() ?? "an official letter"}.`,
      what_you_must_do: f.requests[0] ?? "The letter does not say.",
      by_when: f.deadlines[0] ?? "The letter does not say.",
      if_you_do_nothing: f.requests[1] ?? "The letter does not say.",
      questions_to_ask: ["Can I have more time?", "Who can I talk to about this?"],
    };
  }

  async explainOnDevice(letter: string): Promise<RunResult> {
    if (this.state !== "available") throw new LetterAIError("device-unavailable", "On-device model not ready.");
    await this.wait();
    return { explanation: this.explain(letter), source: "on_device", ms: this.o.delayMs };
  }

  async explainInCloud(masked: string): Promise<RunResult> {
    await this.wait();
    if (!navigator.onLine) throw new LetterAIError("offline", "Offline.");
    if (this.o.cloud === "quota") throw new LetterAIError("quota", "429 quota exceeded");
    if (this.o.cloud === "app-check") throw new LetterAIError("app-check", "App Check token rejected");
    if (this.o.cloud === "error") throw new LetterAIError("cloud-error", "500");
    return { explanation: this.explain(masked), source: "in_cloud", ms: this.o.delayMs };
  }

  async findNamesOnDevice(): Promise<string[]> {
    await this.wait(50);
    return [];
  }

  async transcribeOnDevice(): Promise<string> {
    if (this.state !== "available") throw new LetterAIError("device-unavailable", "On-device model not ready.");
    await this.wait();
    return "";
  }
}
