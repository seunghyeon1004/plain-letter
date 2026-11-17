import type { DeviceState } from "../route/decide";

/** The four answers, plus questions the reader can ask. Same shape on device and in the cloud. */
export interface Explanation {
  what_this_is: string;
  what_you_must_do: string;
  by_when: string;
  if_you_do_nothing: string;
  questions_to_ask: string[];
}

export type Source = "on_device" | "in_cloud";

export interface RunResult {
  explanation: Explanation;
  source: Source;
  ms: number;
}

export type AIFailure =
  | "device-unavailable"
  | "device-too-long"
  | "device-bad-output"
  | "offline"
  | "quota"
  | "app-check"
  | "cloud-error"
  | "privacy-invariant";

export class LetterAIError extends Error {
  constructor(
    readonly kind: AIFailure,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LetterAIError";
  }
}

/**
 * Everything the UI needs from a model. Two implementations: Firebase AI Logic
 * (real) and a fake for development and tests.
 */
export interface LetterAI {
  readonly label: string;
  /** Availability of the on-device model for these languages. */
  deviceState(letterLang: string, outputLang: string, withImage?: boolean): Promise<DeviceState>;
  /** Must be called from a user gesture. Starts or waits for the model download. */
  prepareDevice(onProgress: (fraction: number) => void): Promise<void>;
  /** Raw letter text. ONLY_ON_DEVICE: throws instead of ever using the cloud. */
  explainOnDevice(letter: string, letterLang: string, outputLang: string): Promise<RunResult>;
  /** Masked text only. ONLY_IN_CLOUD. */
  explainInCloud(maskedLetter: string, outputLang: string): Promise<RunResult>;
  /** Private-person names, found on device (used to strengthen masking). */
  findNamesOnDevice(letter: string, letterLang: string): Promise<string[]>;
  /** Text from a photo, read on device. The image never leaves. */
  transcribeOnDevice(image: Blob): Promise<string>;
}
