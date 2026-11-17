/** Tunables. Defaults live here; Firebase Remote Config can override them without a redeploy. */
export interface RuntimeConfig {
  /** Cloud model for masked letters (Gemini Developer API, free tier). */
  cloudModel: string;
  /** Input-token budget for the on-device model (its window is 9216; the rest is prompt, schema and answer). */
  deviceBudgetTokens: number;
  /** Characters per token for the length estimate. */
  charsPerToken: number;
  /** Chunk size for on-device name finding in long letters. */
  nameChunkChars: number;
}

export const DEFAULT_CONFIG: RuntimeConfig = {
  cloudModel: "gemini-3.5-flash-lite",
  deviceBudgetTokens: 6000,
  charsPerToken: 4,
  nameChunkChars: 6000,
};

export const REMOTE_CONFIG_KEYS: Record<keyof RuntimeConfig, string> = {
  cloudModel: "cloud_model",
  deviceBudgetTokens: "device_budget_tokens",
  charsPerToken: "chars_per_token",
  nameChunkChars: "name_chunk_chars",
};
