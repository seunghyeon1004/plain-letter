/** Languages the on-device model (Chrome Prompt API) accepts, per developer.chrome.com/docs/ai/prompt-api. */
export const DEVICE_LANGS = ["en", "es", "de", "fr", "ja"] as const;

export interface ReaderLanguage {
  code: string;
  label: string; // in its own language
  english: string;
}

export const READER_LANGUAGES: ReaderLanguage[] = [
  { code: "en", label: "English", english: "English" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "de", label: "Deutsch", english: "German" },
  { code: "fr", label: "Français", english: "French" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "zh", label: "中文", english: "Chinese (Simplified)" },
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese" },
  { code: "ar", label: "العربية", english: "Arabic" },
  { code: "uk", label: "Українська", english: "Ukrainian" },
  { code: "pt", label: "Português", english: "Portuguese" },
  { code: "pl", label: "Polski", english: "Polish" },
  { code: "tr", label: "Türkçe", english: "Turkish" },
  { code: "tl", label: "Tagalog", english: "Tagalog" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
];

export function languageName(code: string): string {
  return READER_LANGUAGES.find((l) => l.code === code)?.english ?? code;
}

export function deviceSupports(code: string): boolean {
  return (DEVICE_LANGS as readonly string[]).includes(code);
}

const STOP: Record<string, string[]> = {
  en: ["the", "and", "you", "your", "that", "this", "will", "must", "with", "for", "have", "not"],
  de: ["der", "die", "und", "das", "sie", "ihre", "nicht", "bitte", "wir", "den", "mit", "ist"],
  es: ["el", "la", "de", "que", "los", "las", "por", "para", "usted", "su", "una", "con"],
  fr: ["le", "la", "les", "des", "vous", "votre", "est", "pour", "une", "que", "pas", "avec"],
};

/**
 * Cheap, deterministic guess of the letter's language. Good enough to decide
 * whether the on-device model can read it; never shown as a fact to the user.
 */
export function guessLanguage(text: string): string {
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  const hangul = count(/[가-힯]/g);
  const kana = count(/[぀-ヿ]/g);
  const han = count(/[一-鿿]/g);
  const cyr = count(/[Ѐ-ӿ]/g);
  const arab = count(/[؀-ۿ]/g);
  const deva = count(/[ऀ-ॿ]/g);
  const latin = count(/[A-Za-zÀ-ÿ]/g);
  const total = hangul + kana + han + cyr + arab + deva + latin;
  if (total === 0) return "unknown";
  if (hangul / total > 0.2) return "ko";
  if (kana / total > 0.1) return "ja";
  if (han / total > 0.2) return "zh";
  if (cyr / total > 0.2) return "uk";
  if (arab / total > 0.2) return "ar";
  if (deva / total > 0.2) return "hi";
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let best = "unknown";
  let bestScore = 0;
  for (const [lang, stops] of Object.entries(STOP)) {
    const set = new Set(stops);
    const score = words.filter((w) => set.has(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : "unknown";
}

/** Rough token estimate. Latin scripts ~4 chars/token; CJK and similar ~1 char/token. */
export function estimateTokens(text: string, charsPerToken = 4): number {
  const wide = (text.match(/[぀-ヿ一-鿿가-힯]/g) ?? []).length;
  return Math.ceil(wide + (text.length - wide) / charsPerToken);
}
