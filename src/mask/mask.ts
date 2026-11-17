import { ENTITY_TYPES, type EntityType, type MaskEntry, type MaskResult, type Span } from "./types";

/**
 * Picks a token prefix that never occurs in the text, so a placeholder can
 * never be confused with something the letter itself says.
 * Tokens look like `[NAME_1]`, or `[PL_NAME_1]` if the letter already
 * contains `[NAME_`, and so on.
 */
export function pickPrefix(text: string): string {
  for (let i = 0; ; i++) {
    const p = i === 0 ? "" : `PL${i === 1 ? "" : i}_`;
    if (!ENTITY_TYPES.some((t) => text.includes(`[${p}${t}_`))) return p;
  }
}

/** Removes overlaps: earliest start wins, then the longer span. */
export function normalizeSpans(spans: Span[], textLength: number): Span[] {
  const sorted = spans
    .filter((s) => s.start >= 0 && s.end <= textLength && s.end > s.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  let lastEnd = -1;
  for (const s of sorted) {
    if (s.start >= lastEnd) {
      out.push(s);
      lastEnd = s.end;
    }
  }
  return out;
}

/** Replaces every span with a stable placeholder. The same value always gets the same placeholder. */
export function mask(text: string, spans: Span[]): MaskResult {
  const prefix = pickPrefix(text);
  const clean = normalizeSpans(spans, text.length);
  const counters: Record<string, number> = {};
  const byKey = new Map<string, MaskEntry>();
  const entries: MaskEntry[] = [];
  const map: Record<string, string> = {};
  let masked = "";
  let cursor = 0;
  for (const s of clean) {
    const value = text.slice(s.start, s.end);
    const key = `${s.type}\u0000${value}`;
    let entry = byKey.get(key);
    if (!entry) {
      const n = (counters[s.type] = (counters[s.type] ?? 0) + 1);
      entry = { token: `[${prefix}${s.type}_${n}]`, type: s.type, value, source: s.source, count: 0 };
      byKey.set(key, entry);
      entries.push(entry);
      map[entry.token] = value;
    }
    entry.count++;
    masked += text.slice(cursor, s.start) + entry.token;
    cursor = s.end;
  }
  masked += text.slice(cursor);
  return { masked, entries, map };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Puts the original values back, in one pass. Unknown tokens are left untouched. */
export function restore(text: string, map: Record<string, string>): string {
  const tokens = Object.keys(map);
  if (tokens.length === 0) return text;
  const re = new RegExp(tokens.sort((a, b) => b.length - a.length).map(escapeRe).join("|"), "g");
  return text.replace(re, (t) => map[t] ?? t);
}

/** Every token present in a masked text, in order of first appearance. */
export function tokensIn(masked: string, map: Record<string, string>): string[] {
  return Object.keys(map).filter((t) => masked.includes(t));
}

export type { EntityType };
