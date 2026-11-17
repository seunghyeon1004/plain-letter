import { DATE_SRC } from "../mask/detect";

/**
 * No-model fallback. Used when the device has no model and the cloud is out of
 * reach (offline). It finds sentences with deadlines, amounts and requests, so
 * the reader still gets the most important lines. It does not interpret.
 */
export interface LocalFindings {
  deadlines: string[];
  amounts: string[];
  requests: string[];
}

const DEADLINE_WORDS =
  /\b(?:by|before|until|no later than|deadline|due|within|from|starting|bis(?: zum)?|spätestens|ab dem|fristgerecht|antes del?|hasta(?: el)?|plazo|a partir del?|avant le|au plus tard|jusqu'au|à partir du)\b/i;
const REQUEST_WORDS =
  /\b(?:must|need to|have to|required|please|you should|you may|contact|bitte|müssen|sind verpflichtet|debe|deberá|tiene que|por favor|veuillez|vous devez|merci de)\b/i;
const AMOUNT = /(?:[$£€¥]\s?\d[\d.,\s]*\d|\d[\d.,]*\s?(?:EUR|USD|GBP|€|euros?|dollars?|pounds?))/gi;

export function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[^\d\s][.!?])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0 && s.length < 600);
}

export function extractLocal(text: string): LocalFindings {
  const dateRe = new RegExp(DATE_SRC, "i");
  const ss = sentences(text);
  const deadlines = ss.filter((s) => dateRe.test(s) && DEADLINE_WORDS.test(s) && !/birth|geburt|nacimiento|naissance/i.test(s));
  const requests = ss.filter((s) => REQUEST_WORDS.test(s) && !deadlines.includes(s));
  const amounts = [...new Set([...text.matchAll(AMOUNT)].map((m) => m[0].trim()))];
  return { deadlines: dedupe(deadlines).slice(0, 5), amounts: amounts.slice(0, 6), requests: dedupe(requests).slice(0, 5) };
}

function dedupe(a: string[]): string[] {
  return [...new Set(a)];
}
