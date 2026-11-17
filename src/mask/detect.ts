import type { DetectionSource, EntityType, Span } from "./types";

/**
 * Deterministic detectors for personal details in official letters.
 * They run on every path. The on-device model can add more names on top
 * (see `valueSpans`), and the user can add or remove items in the review step.
 *
 * Policy: hide who the reader is and how to find or identify them.
 * Keep what the reader needs answered: deadlines, amounts, ordinary dates,
 * the sender's role and the subject of the letter.
 */

const MONTHS =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|" +
  "Januar|Februar|März|Maerz|Juni|Juli|Oktober|Dezember|" +
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|" +
  "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre";

/** Any date, used only to locate a date of birth next to its label. */
export const DATE_SRC =
  `(?:\\d{4}-\\d{1,2}-\\d{1,2}` +
  `|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}` +
  `|\\d{1,2}(?:st|nd|rd|th)?\\.?\\s+(?:de\\s+)?(?:${MONTHS})\\.?,?\\s+(?:de\\s+)?\\d{4}` +
  `|(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}` +
  `|\\d{4}年\\s?\\d{1,2}月\\s?\\d{1,2}日)`;

const DOB_LABEL =
  "date\\s+of\\s+birth|birth\\s*date|d\\.?\\s?o\\.?\\s?b\\.?|born(?:\\s+on)?|geburtsdatum|geb\\.|geboren(?:\\s+am)?|" +
  "fecha\\s+de\\s+nacimiento|f\\.\\s?nac\\.|nacid[oa](?:\\s+el)?|date\\s+de\\s+naissance|n[ée]e?\\s+le|生年月日";

const ID_LABEL =
  "account|acct|case|reference|ref|policy|customer|client|claim|file|member(?:ship)?|tax(?:payer)?(?:\\s+id)?|invoice|contract|tenancy|lease|" +
  "application|student|patient|benefit|social\\s+security|ssn|national\\s+insurance|ni|iban|passport|permit|visa|licen[cs]e|" +
  "aktenzeichen|az\\.|kundennummer|kunden-?nr\\.?|vertragsnummer|versicherungsnummer|steuernummer|steuer-?id|identifikationsnummer|" +
  "referencia|expediente|n[úu]mero\\s+de\\s+(?:cliente|expediente|p[óo]liza|cuenta)|nie|dni|nif|p[óo]liza|" +
  "num[ée]ro\\s+de\\s+(?:dossier|client|contrat|allocataire)|r[ée]f[ée]rence|dossier|n°\\s*allocataire";

const ID_SUFFIX = "(?:\\s+(?:number|no\\.?|nr\\.?|num\\.?|#|id|n[º°o]\\.?))?";

const HONORIFIC = "Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Herr|Frau|Sr|Sra|Srta|Don|Doña|Mme|Mlle|Monsieur|Madame";
const NAME_WORD = "\\p{Lu}[\\p{L}'’-]+";
const NAME_SEQ = `${NAME_WORD}(?:[ \\t]+${NAME_WORD}){0,3}`;

/** Words that follow "Dear" but are not anyone's name. */
const NOT_A_NAME = new Set(
  (
    "Sir Madam Madame Sirs Tenant Tenants Customer Customers Resident Residents Applicant Taxpayer Parent Parents Guardian " +
    "Policyholder Member Members Client Patient Student Colleague Colleagues Team Neighbour Neighbor Neighbours Neighbors Friend " +
    "Occupier Occupant Homeowner Owner Household Family Families Account Holder Recipient Beneficiary Claimant " +
    "Damen Herren Kunde Kundin Mieter Mieterin Señor Señora Señores Cliente Inquilino Inquilina Monsieur Madame Locataire Allocataire " +
    "Ihre Ihr Unser Unsere Su Sus Votre Vos The A An Your You Our We To From Re Subject Date And Or Of Sehr Geehrte Geehrter Liebe Lieber Estimado Estimada Querido Querida Cher Chère"
  ).split(" "),
);

const STREET_WORDS =
  "street|st\\.?|avenue|ave\\.?|road|rd\\.?|lane|ln\\.?|drive|boulevard|blvd\\.?|court|ct\\.?|way|place|pl\\.?|terrace|close|crescent|" +
  "highway|hwy\\.?|parkway|square|sq\\.?|apt\\.?|apartment|flat|suite|unit|" +
  "straße|strasse|str\\.|weg|gasse|platz|allee|ring|damm|ufer|" +
  "calle|c/|avenida|avda\\.?|plaza|paseo|carrer|camino|piso|" +
  "rue|chemin|allée|impasse|quai|cours";

function push(out: Span[], start: number, end: number, type: EntityType, source: DetectionSource = "pattern"): void {
  out.push({ start, end, type, source });
}

function trimSpan(text: string, start: number, end: number): [number, number] {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(text[s]!)) s++;
  while (e > s && /[\s,;:.]/.test(text[e - 1]!)) e--;
  // keep a trailing period if it belongs to an abbreviation like "St." or "Rd."
  if (text[e] === "." && /(?:St|Rd|Ave|Blvd|Ct|Pl|Str|Ln|Sq|Hwy|Avda)$/i.test(text.slice(s, e))) e++;
  return [s, e];
}

function addTrimmed(out: Span[], text: string, start: number, end: number, type: EntityType): void {
  const [s, e] = trimSpan(text, start, end);
  if (e > s) push(out, s, e, type);
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

export function detectEmails(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    push(out, m.index!, m.index! + m[0].length, "EMAIL");
  }
  return out;
}

const DATE_RE_FULL = new RegExp(`^${DATE_SRC}$`, "i");

export function detectPhones(text: string): Span[] {
  const out: Span[] = [];
  const re = /(?<![\w€$£¥/.,-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,5}\)[ .-]?)?\d{2,5}(?:[ .-]\d{2,6}){1,4}(?![\w/-]|[.,]\d)/g;
  for (const m of text.matchAll(re)) {
    const v = m[0];
    const d = digitCount(v);
    if (d < 7 || d > 15) continue;
    if (DATE_RE_FULL.test(v)) continue; // 12.03.2026
    if (/^\d{3}-\d{2}-\d{4}$/.test(v)) continue; // SSN, handled as IDNUM
    // a phone either has a + / ( prefix, or its first group is short like an area code
    if (!/^[+(]/.test(v) && !/^\d{2,5}[ .-]/.test(v)) continue;
    // Thousands-grouped amounts like "1 250 000" stay visible unless prefixed with +
    if (!/^[+(]/.test(v) && /^\d{1,3}(?:[ ]\d{3})+$/.test(v)) continue;
    push(out, m.index!, m.index! + v.length, "PHONE");
  }
  return out;
}

export function detectDob(text: string): Span[] {
  const out: Span[] = [];
  const re = new RegExp(`(?:${DOB_LABEL})\\s*[:：]?\\s*(?:\\(\\s*)?(${DATE_SRC})`, "giu");
  for (const m of text.matchAll(re)) {
    const date = m[1]!;
    const start = m.index! + m[0].lastIndexOf(date);
    push(out, start, start + date.length, "DOB");
  }
  return out;
}

export function detectIds(text: string): Span[] {
  const out: Span[] = [];
  const value = "([A-Z0-9][A-Z0-9]{0,14}(?:[-/.][A-Z0-9]{1,14}){0,5}(?:[ ]\\d{2,6}){0,4})";
  const labeled = new RegExp(`(?<![\\p{L}])(?:(?:${ID_LABEL})(?![\\p{L}])${ID_SUFFIX}[ \\t]*){1,3}[:#：.]?\\s*(?:is\\s+)?${value}`, "giu");
  for (const m of text.matchAll(labeled)) {
    const v = m[1]!;
    if (digitCount(v) < 3) continue;
    if (DATE_RE_FULL.test(v)) continue;
    const start = m.index! + m[0].lastIndexOf(v);
    // UK NI numbers end in a lone capital letter ("QX 44 18 92 C")
    const tail = /^ [A-Z](?![\p{L}\p{N}])/u.exec(text.slice(start + v.length));
    addTrimmed(out, text, start, start + v.length + (tail ? 2 : 0), "IDNUM");
  }
  // IBAN
  for (const m of text.matchAll(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g)) {
    push(out, m.index!, m.index! + m[0].length, "IDNUM");
  }
  // US SSN shape
  for (const m of text.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) push(out, m.index!, m.index! + m[0].length, "IDNUM");
  // Long bare numbers (9+ digits) are identifiers, not amounts.
  for (const m of text.matchAll(/(?<![\d.,€$£])\b\d{9,}\b(?![.,]\d)/g)) push(out, m.index!, m.index! + m[0].length, "IDNUM");
  return out;
}

interface Line {
  text: string;
  start: number;
}

function lines(text: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  for (const part of text.split("\n")) {
    out.push({ text: part, start });
    start += part.length + 1;
  }
  return out;
}

const STREET_LINE = new RegExp(`(?:^|[\\s,])(?:${STREET_WORDS})(?=$|[\\s,.])`, "iu");
const STREET_COMPOUND = /\p{L}+(?:straße|strasse|weg|gasse|platz|allee)\b/iu;
const POSTAL_LINE = [
  /^[\p{L} .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/u, // Springfield, IL 62704
  /^(?:[A-Z]-)?\d{4,5}\s+\p{Lu}[\p{L} .'()-]+$/u, // 10115 Berlin, 28013 Madrid, 75002 Paris
  /^[\p{L} .'-]*\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/u, // Leeds LS1 4AB
  /^〒?\d{3}-\d{4}/u, // Japan
];

function isAddressLine(t: string): boolean {
  const s = t.trim();
  if (s.length === 0 || s.length > 90) return false;
  if (POSTAL_LINE.some((re) => re.test(s))) return true;
  const hasNumber = /\d/.test(s);
  const words = s.split(/\s+/).length;
  if (hasNumber && words <= 9 && (STREET_LINE.test(s) || STREET_COMPOUND.test(s))) {
    // Avoid sentences that mention a street word: require a short line or a leading house number.
    return words <= 7 || /^\d{1,5}[A-Za-z]?\s/.test(s);
  }
  return false;
}

/** Organisation lines (sender blocks, signatures) are not personal data and help the reader. */
const ORG_WORDS =
  /\b(?:AG|GmbH|KG|e\.V\.|Ltd|Limited|LLC|LLP|Inc|Corp|Co|PLC|S\.A\.|SL|SAS|SARL|Agency|Authority|Bank|Board|Bureau|Centre|Center|Clinic|College|Company|Council|County|Court|Department|Dept|Division|Foundation|Group|Hospital|Housing|Insurance|Management|Ministry|Office|Partners|Property|Recovery|Registry|School|Service|Services|Team|Tribunal|Trust|Unit|University|Amt|Behörde|Finanzamt|Jobcenter|Kasse|Krankenkasse|Schule|Stadt|Versicherung|Verwaltung|Ayuntamiento|Agencia|Ministerio|Servicio|Seguros|Colegio|Caisse|Mairie|Préfecture|Service|Assurance|École)\b/u;

function looksLikeNameLine(t: string): boolean {
  if (ORG_WORDS.test(t)) return false;
  const s = t.trim().replace(/^(?:Mr|Mrs|Ms|Miss|Mx|Dr|Herr|Frau|Sr|Sra|M|Mme)\.?\s+/u, "");
  if (s.length < 3 || s.length > 45 || /\d/.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => new RegExp(`^${NAME_WORD}$`, "u").test(w) && !NOT_A_NAME.has(w));
}

export function detectAddresses(text: string): Span[] {
  const out: Span[] = [];
  const ls = lines(text);
  ls.forEach((l, i) => {
    if (!isAddressLine(l.text)) return;
    addTrimmed(out, text, l.start, l.start + l.text.length, "ADDRESS");
    // The name line directly above an address block is the addressee.
    const prev = ls[i - 1];
    if (prev && looksLikeNameLine(prev.text) && !isAddressLine(prev.text)) {
      const lead = prev.text.match(/^\s*(?:(?:Mr|Mrs|Ms|Miss|Mx|Dr|Herr|Frau|Sr|Sra|M|Mme)\.?\s+)?/u)![0].length;
      addTrimmed(out, text, prev.start + lead, prev.start + prev.text.length, "NAME");
    }
  });
  // Inline street addresses in running text
  const inline = [
    /\b\d{1,5}[A-Za-z]?\s+(?:\p{Lu}[\p{L}'-]+\s+){1,3}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Drive|Boulevard|Blvd\.?|Way|Place|Court|Terrace|Close|Crescent)(?:,?\s+(?:Apt\.?|Apartment|Flat|Unit|Suite)\s*\w+)?/gu,
    /\b\p{Lu}[\p{L}]*(?:straße|strasse|weg|gasse|platz|allee)\s+\d{1,4}[a-z]?\b/gu,
    /\b(?:Calle|Avenida|Plaza|Paseo|Carrer)\s+(?:(?:de|del|la|las|los)\s+)?(?:\p{Lu}[\p{L}]+\s+){1,3}\d{1,4}\b/gu,
    /\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|boulevard|chemin|allée|impasse|quai|place)\s+(?:(?:de|du|des|la|le|l')\s*)*(?:\p{Lu}[\p{L}'-]+\s?){1,3}/gu,
  ];
  for (const re of inline) for (const m of text.matchAll(re)) addTrimmed(out, text, m.index!, m.index! + m[0].length, "ADDRESS");
  return out;
}

export function detectNames(text: string): Span[] {
  const out: Span[] = [];
  const add = (full: string, idx: number, name: string) => {
    const words = name.split(/\s+/);
    // drop generic trailing words ("Ms Okafor Tenant")
    while (words.length && NOT_A_NAME.has(words[words.length - 1]!)) words.pop();
    while (words.length && NOT_A_NAME.has(words[0]!)) words.shift();
    if (!words.length) return;
    const clean = words.join(" ");
    const start = idx + full.indexOf(clean);
    if (start < idx) return;
    push(out, start, start + clean.length, "NAME");
  };
  // Honorific + name
  const hon = new RegExp(`(?<![\\p{L}])(?:${HONORIFIC})\\.?[ \\t]+(${NAME_SEQ})|(?<![\\p{L}])M\\.[ \\t]+(${NAME_SEQ})`, "gu");
  for (const m of text.matchAll(hon)) add(m[0], m.index!, (m[1] ?? m[2])!);
  // Salutation lines
  const sal = new RegExp(
    `^[ \\t]*(?:Dear|Hello|Hi|Sehr geehrte[rs]?|Liebe[rs]?|Estimad[oa]s?|Querid[oa]s?|Cher|Chère|Bonjour)[ \\t]+(?:(?:${HONORIFIC}|M)\\.?[ \\t]+)?(${NAME_SEQ})`,
    "gmu",
  );
  for (const m of text.matchAll(sal)) add(m[0], m.index!, m[1]!);
  // Labeled fields
  const lab = new RegExp(
    `(?<![\\p{L}])(?:Name|Full name|Tenant|Landlord|Applicant|Policyholder|Policy holder|Insured|Taxpayer|Student|Pupil|Child|Parent|Guardian|Patient|Account holder|Beneficiary|Recipient|Attn\\.?|Attention|Nombre|Inquilin[oa]|Solicitante|Asegurad[oa]|Alumn[oa]|Mieter(?:in)?|Antragsteller(?:in)?|Versicherte[r]?|Schüler(?:in)?|Nom|Prénom|Locataire|Assuré[e]?|Élève)(?:[ \\t]+(?:of|de|von))?[ \\t]*[:：][ \\t]*(${NAME_SEQ})`,
    "gu",
  );
  for (const m of text.matchAll(lab)) add(m[0], m.index!, m[1]!);
  // Name under a closing ("Sincerely,\nJordan Reyes")
  const ls = lines(text);
  ls.forEach((l, i) => {
    if (!/^\s*(?:Sincerely|Yours sincerely|Yours faithfully|Kind regards|Best regards|Regards|Respectfully|Mit freundlichen Grüßen|Freundliche Grüße|Atentamente|Saludos cordiales|Cordialement|Bien à vous)\s*,?\s*$/iu.test(l.text)) return;
    for (let j = i + 1; j < Math.min(ls.length, i + 3); j++) {
      const n = ls[j]!;
      if (n.text.trim() === "") continue;
      if (looksLikeNameLine(n.text)) addTrimmed(out, text, n.start, n.start + n.text.length, "NAME");
      break;
    }
  });
  return out;
}

/**
 * Spans for every whole-word occurrence of the given values (names found by
 * the on-device model or added by the user). For names, surnames and given
 * names on their own are hidden too ("Ms Okafor").
 */
export function valueSpans(text: string, values: { value: string; type: EntityType; source: DetectionSource }[]): Span[] {
  const out: Span[] = [];
  const seen = new Set<string>();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const addAll = (needle: string, type: EntityType, source: DetectionSource) => {
    const key = `${type}\u0000${needle}`;
    if (seen.has(key) || needle.trim().length < 2) return;
    seen.add(key);
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(needle)}(?![\\p{L}\\p{N}])`, "gu");
    for (const m of text.matchAll(re)) out.push({ start: m.index!, end: m.index! + needle.length, type, source });
  };
  for (const v of values) {
    const value = v.value.trim();
    addAll(value, v.type, v.source);
    if (v.type === "NAME") {
      for (const part of value.split(/\s+/)) {
        if (part.length >= 3 && new RegExp(`^${NAME_WORD}$`, "u").test(part) && !NOT_A_NAME.has(part)) addAll(part, "NAME", v.source);
      }
    }
  }
  return out;
}

/** All deterministic detections, plus repeated occurrences of every detected name. */
export function detectAll(text: string, extra: { value: string; type: EntityType; source: DetectionSource }[] = []): Span[] {
  const base = [
    ...detectEmails(text),
    ...detectDob(text),
    ...detectIds(text),
    ...detectPhones(text),
    ...detectAddresses(text),
    ...detectNames(text),
  ];
  const names = base.filter((s) => s.type === "NAME").map((s) => ({ value: text.slice(s.start, s.end), type: "NAME" as const, source: s.source }));
  return [...base, ...valueSpans(text, [...names, ...extra])];
}
