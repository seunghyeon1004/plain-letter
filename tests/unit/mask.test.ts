import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { detectAddresses, detectAll, detectDob, detectEmails, detectIds, detectNames, detectPhones } from "../../src/mask/detect";
import { mask, pickPrefix, restore } from "../../src/mask/mask";
import { ENTITY_TYPES, type Span } from "../../src/mask/types";
import { SAMPLES } from "../../src/samples/letters";

const values = (text: string, spans: Span[]) => spans.map((s) => text.slice(s.start, s.end));

describe("EMAIL", () => {
  it("finds addresses and nothing else", () => {
    const t = "Write to leasing@harrowgate-pm.example or call. Not an email: a@b, @handle.";
    expect(values(t, detectEmails(t))).toEqual(["leasing@harrowgate-pm.example"]);
  });
});

describe("PHONE", () => {
  it("finds common formats", () => {
    const t = "Call (541) 555-0187, +44 1632 960418, 0999 123 4567 or 01632 960 418.";
    expect(values(t, detectPhones(t))).toEqual(["(541) 555-0187", "+44 1632 960418", "0999 123 4567", "01632 960 418"]);
  });
  it("keeps amounts, dates and years visible", () => {
    const t = "Pay $1,595.00 or 1 250 000 by 12.03.2026 or 2026-04-01; 64,20 EUR in 2026.";
    expect(detectPhones(t)).toEqual([]);
  });
});

describe("DOB", () => {
  it("hides only dates next to a birth label", () => {
    const t = "Date of birth: 07 March 1984\nGeburtsdatum: 14.06.1991\nfecha de nacimiento 3 de mayo de 1990\nPay by May 1, 2026.";
    expect(values(t, detectDob(t))).toEqual(["07 March 1984", "14.06.1991", "3 de mayo de 1990"]);
  });
});

describe("IDNUM", () => {
  it("finds labelled account, case and policy numbers", () => {
    const t =
      "Tenant account: HPM-55120-3B\nCase reference: NVB-3390-118-24\nVersicherungsnummer: LV-7781-2204-K\nStudent ID: WPS-200417\nReferencia: EXP/2026/00412";
    expect(values(t, detectIds(t))).toEqual(["HPM-55120-3B", "NVB-3390-118-24", "LV-7781-2204-K", "WPS-200417", "EXP/2026/00412"]);
  });
  it("finds IBANs, SSN-shaped and long bare numbers", () => {
    const t = "IBAN DE89 3704 0044 0532 0130 00, SSN 123-45-6789, file 4410098812.";
    const v = values(t, detectIds(t));
    expect(v).toContain("DE89 3704 0044 0532 0130 00");
    expect(v).toContain("123-45-6789");
    expect(v).toContain("4410098812");
  });
  it("leaves label words without digits alone", () => {
    const t = "Your reference: please quote it. Account details follow.";
    expect(detectIds(t)).toEqual([]);
  });
});

describe("ADDRESS", () => {
  it("finds address lines in letter headers", () => {
    const t = "Maria Elena Okafor\n14 Larkspur Lane, Apt 3B\nEastmere, OR 97998\n\nFrau\nAmira Haddad\nKirschblütenweg 7\n99998 Lindhaven";
    const v = values(t, detectAddresses(t));
    expect(v).toEqual(
      expect.arrayContaining(["14 Larkspur Lane, Apt 3B", "Eastmere, OR 97998", "Kirschblütenweg 7", "99998 Lindhaven", "Maria Elena Okafor", "Amira Haddad"]),
    );
  });
  it("finds inline street addresses", () => {
    const t = "The inspection at 27 Fernhollow Road is booked. Wir kommen zur Lindenstraße 12a.";
    expect(values(t, detectAddresses(t))).toEqual(["27 Fernhollow Road", "Lindenstraße 12a"]);
  });
  it("does not treat a sentence that mentions a road as an address", () => {
    const t = "Please do not park on the road in front of the school between 8 and 9 in the morning, as buses need the space.";
    expect(detectAddresses(t)).toEqual([]);
  });
});

describe("NAME", () => {
  it("finds honorific, salutation, labelled and signature names", () => {
    const t = "Dear Ms Okafor,\nParent/Guardian of: Tomasz Novak\nSehr geehrte Frau Haddad,\nM. Dupont\n\nSincerely,\n\nJordan Reyes\nLeasing Manager";
    expect(values(t, detectNames(t))).toEqual(expect.arrayContaining(["Okafor", "Tomasz Novak", "Haddad", "Dupont", "Jordan Reyes"]));
  });
  it("keeps organisation names visible (sender blocks and signatures)", () => {
    const t = "Harrowgate Property Management\n88 Quillon Avenue, Suite 400\n\nMit freundlichen Grüßen\n\nIhre Lindhaven Versicherung\n\nYours sincerely,\n\nOverpayment Recovery Unit";
    const v = values(t, detectAll(t));
    expect(v).not.toContain("Harrowgate Property Management");
    expect(v.join(" ")).not.toMatch(/Lindhaven|Ihre|Overpayment/);
  });
  it("hides a full UK National Insurance number", () => {
    const t = "National Insurance number: QX 44 18 92 C\nNext line";
    expect(values(t, detectIds(t))).toEqual(["QX 44 18 92 C"]);
  });
  it("ignores generic salutations", () => {
    const t = "Dear Tenant,\nDear Sir or Madam,\nDear Customer,";
    expect(detectNames(t)).toEqual([]);
  });
  it("hides every later mention of a detected name", () => {
    const t = "Dear Mr Novak,\nParent/Guardian of: Tomasz Novak\nTomasz has had 9 absences.";
    const v = values(t, detectAll(t));
    expect(v.filter((x) => x === "Tomasz").length).toBeGreaterThanOrEqual(1);
    expect(v).toContain("Novak");
  });
});

describe("mask and restore", () => {
  it("never sends any sensitive string from the samples", () => {
    for (const s of SAMPLES) {
      const r = mask(s.text, detectAll(s.text));
      for (const secret of s.sensitive) expect(r.masked, `${s.id}: ${secret}`).not.toContain(secret);
      expect(restore(r.masked, r.map)).toBe(s.text);
    }
  });

  it("keeps deadlines and amounts visible", () => {
    const s = SAMPLES[0]!;
    const r = mask(s.text, detectAll(s.text));
    for (const keep of ["April 1, 2026", "May 1, 2026", "$1,595.00", "$1,450.00"]) expect(r.masked).toContain(keep);
  });

  it("uses one token per distinct value", () => {
    const t = "Dear Ms Okafor, Ms Okafor must pay.";
    const r = mask(t, detectAll(t));
    expect(r.entries).toHaveLength(1);
    expect(r.masked).toBe("Dear Ms [NAME_1], Ms [NAME_1] must pay.");
  });

  it("switches prefix when the letter already contains a token-like string", () => {
    const t = "Template field [NAME_1] was left in. Dear Ms Okafor,";
    expect(pickPrefix(t)).toBe("PL_");
    const r = mask(t, detectAll(t));
    expect(r.masked).toContain("[NAME_1] was left in");
    expect(r.masked).toContain("[PL_NAME_1]");
    expect(restore(r.masked, r.map)).toBe(t);
  });

  it("property: restore(mask(x)) === x for any text and any spans", () => {
    const tokenish = fc.constantFrom("[NAME_1]", "[EMAIL_2]", "[PL_NAME_1]", "[", "]", "_", "Ms Okafor", "a@b.example", "(541) 555-0187", "\n");
    const text = fc.array(fc.oneof(fc.string({ unit: "grapheme" }), tokenish), { maxLength: 30 }).map((a) => a.join(""));
    fc.assert(
      fc.property(
        text,
        fc.array(fc.tuple(fc.nat(), fc.nat(), fc.constantFrom(...ENTITY_TYPES)), { maxLength: 12 }),
        (x, raw) => {
          const spans: Span[] = raw.map(([a, b, type]) => {
            const s = x.length ? a % (x.length + 1) : 0;
            const e = x.length ? b % (x.length + 1) : 0;
            return { start: Math.min(s, e), end: Math.max(s, e), type, source: "pattern" };
          });
          const r = mask(x, spans);
          expect(restore(r.masked, r.map)).toBe(x);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("property: no placeholder ever occurs in the original text", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.string(), fc.constantFrom("[NAME_", "[PL_NAME_", "[EMAIL_1]", "Dear Ms Okafor,")), { maxLength: 20 }), (parts) => {
        const x = parts.join(" ");
        const r = mask(x, detectAll(x));
        for (const e of r.entries) expect(x.includes(e.token)).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  it("property: restore(mask(x)) === x with the real detectors on random letters", () => {
    const piece = fc.constantFrom(...SAMPLES.flatMap((s) => s.text.split("\n")));
    fc.assert(
      fc.property(fc.array(piece, { maxLength: 25 }), (ls) => {
        const x = ls.join("\n");
        const r = mask(x, detectAll(x));
        expect(restore(r.masked, r.map)).toBe(x);
      }),
      { numRuns: 300 },
    );
  });
});
