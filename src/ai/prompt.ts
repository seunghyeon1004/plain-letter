import { languageName } from "../route/language";
import type { Explanation } from "./types";

/** Plain JSON Schema, used as the on-device responseConstraint. */
export const EXPLANATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    what_this_is: { type: "string" },
    what_you_must_do: { type: "string" },
    by_when: { type: "string" },
    if_you_do_nothing: { type: "string" },
    questions_to_ask: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["what_this_is", "what_you_must_do", "by_when", "if_you_do_nothing", "questions_to_ask"],
  additionalProperties: false,
} as const;

export const NAMES_JSON_SCHEMA = {
  type: "object",
  properties: { names: { type: "array", items: { type: "string" } } },
  required: ["names"],
  additionalProperties: false,
} as const;

/**
 * One prompt for both paths, so the on-device and cloud answers are
 * comparable and the ledger shows exactly what the cloud was asked.
 */
export function explainPrompt(letter: string, outputLang: string, masked: boolean): string {
  const lang = languageName(outputLang);
  return [
    `You help someone who finds official letters hard to read. Explain the letter below in ${lang}, in short, plain sentences a 12-year-old would understand.`,
    "Answer with JSON only, using these fields:",
    '- "what_this_is": what kind of letter this is and who sent it (one or two sentences).',
    '- "what_you_must_do": the action the reader has to take, if any.',
    '- "by_when": the deadline, copied exactly as the letter writes it. If there is no deadline, say so.',
    '- "if_you_do_nothing": what the letter says will happen if the reader does nothing.',
    '- "questions_to_ask": up to 3 short questions the reader could ask the sender or an adviser.',
    "Use only facts that are in the letter. If the letter does not say something, write that it does not say. Do not give legal advice.",
    masked
      ? "Some personal details were replaced with placeholders such as [NAME_1] or [IDNUM_1]. Keep each placeholder exactly as written wherever you need it. Never guess what it hides."
      : "",
    "",
    "LETTER:",
    letter,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function namesPrompt(letterChunk: string): string {
  return [
    "List the full names of private people mentioned in this letter: the person it is addressed to, family members, and the person who signed it.",
    "Do not list organisations, companies, agencies, schools, towns or job titles.",
    'Answer with JSON only: {"names": ["..."]}. Copy each name exactly as it appears. If there are none, answer {"names": []}.',
    "",
    "LETTER:",
    letterChunk,
  ].join("\n");
}

export const TRANSCRIBE_PROMPT =
  "This is a photo of a letter. Copy all of the text in the letter exactly, line by line, as plain text. Do not explain or summarise it. Output only the text.";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Parses and validates model output. Throws on anything that is not a usable explanation. */
export function parseExplanation(raw: string): Explanation {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const e: Explanation = {
    what_this_is: asString(o.what_this_is),
    what_you_must_do: asString(o.what_you_must_do),
    by_when: asString(o.by_when),
    if_you_do_nothing: asString(o.if_you_do_nothing),
    questions_to_ask: Array.isArray(o.questions_to_ask) ? o.questions_to_ask.map(asString).filter(Boolean).slice(0, 3) : [],
  };
  if (!e.what_this_is || !e.what_you_must_do) throw new Error("Model output is missing required fields");
  return e;
}

export function parseNames(raw: string, letter: string): string[] {
  try {
    const start = raw.indexOf("{");
    const o = JSON.parse(raw.slice(start, raw.lastIndexOf("}") + 1)) as { names?: unknown };
    if (!Array.isArray(o.names)) return [];
    // Keep only names that literally appear in the letter: the model may not invent anything we then "hide".
    return [...new Set(o.names.map(asString).filter((n) => n.length >= 2 && n.length <= 60 && letter.includes(n)))];
  } catch {
    return [];
  }
}

/** Splits a long letter into chunks that fit the on-device window, on paragraph boundaries. */
export function chunk(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of text.split(/\n{2,}/)) {
    if ((cur + "\n\n" + p).length > maxChars && cur) {
      out.push(cur);
      cur = "";
    }
    if (p.length > maxChars) {
      for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars));
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}
