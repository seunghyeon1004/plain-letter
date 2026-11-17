import { describe, expect, it } from "vitest";
import { extractLocal } from "../../src/extract/deterministic";
import { BENEFIT_REVIEW, INSURANCE_DE, RENT_NOTICE } from "../../src/samples/letters";
import { chunk, explainPrompt, parseExplanation, parseNames } from "../../src/ai/prompt";

describe("local (no-model) findings", () => {
  it("finds the rent deadline and amounts", () => {
    const f = extractLocal(RENT_NOTICE.text);
    expect(f.deadlines.join(" ")).toContain("April 1, 2026");
    expect(f.amounts).toEqual(expect.arrayContaining(["$1,450.00", "$1,595.00"]));
  });
  it("works for German letters", () => {
    const f = extractLocal(INSURANCE_DE.text);
    expect(f.deadlines.join(" ")).toContain("17. November 2026");
    expect(f.amounts.join(" ")).toContain("64,20 EUR");
  });
  it("never reports a date of birth as a deadline", () => {
    expect(extractLocal(BENEFIT_REVIEW.text).deadlines.join(" ")).not.toContain("1984");
  });
});

describe("model output parsing", () => {
  it("accepts valid JSON, even wrapped in text", () => {
    const e = parseExplanation('Here: {"what_this_is":"A","what_you_must_do":"B","by_when":"C","if_you_do_nothing":"D","questions_to_ask":["Q1","Q2","Q3","Q4"]}');
    expect(e.questions_to_ask).toHaveLength(3);
  });
  it("rejects echo output from a stub model", () => {
    expect(() => parseExplanation("CPU backendFastest inferenceTopK: 64, Temp: 1User: hi End.Model: ")).toThrow();
  });
  it("keeps only names that appear in the letter", () => {
    expect(parseNames('{"names":["Maria Elena Okafor","Invented Person"]}', RENT_NOTICE.text)).toEqual(["Maria Elena Okafor"]);
    expect(parseNames("garbage", RENT_NOTICE.text)).toEqual([]);
  });
  it("chunks long letters within the limit", () => {
    const parts = chunk(BENEFIT_REVIEW.text, 4000);
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.every((p) => p.length <= 4000)).toBe(true);
  });
  it("prompt tells the cloud model to keep placeholders only when masked", () => {
    expect(explainPrompt("x", "es", true)).toContain("[NAME_1]");
    expect(explainPrompt("x", "es", false)).not.toContain("placeholder");
    expect(explainPrompt("x", "es", false)).toContain("Spanish");
  });
});
