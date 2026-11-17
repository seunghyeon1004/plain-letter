import { describe, expect, it } from "vitest";
import { decideRoute, type DeviceState, type Path, type RouteInput } from "../../src/route/decide";
import { estimateTokens, guessLanguage } from "../../src/route/language";
import { SAMPLES } from "../../src/samples/letters";

const base: RouteInput = { device: "available", online: true, letterLang: "en", outputLang: "es", estTokens: 400, deviceBudgetTokens: 6000 };

describe("routing decision table", () => {
  const rows: [string, Partial<RouteInput>, Path, string, boolean][] = [
    // name, overrides, path, masker, deviceAfterDownload
    ["ready, short, supported langs", {}, "device", "device+patterns", false],
    ["ready, offline, short", { online: false }, "device", "device+patterns", false],
    ["ready, too long", { estTokens: 9000 }, "cloud-masked", "device+patterns", false],
    ["ready, too long, offline", { estTokens: 9000, online: false }, "local-only", "device+patterns", false],
    ["ready, output Korean", { outputLang: "ko" }, "cloud-masked", "device+patterns", false],
    ["ready, letter in Korean", { letterLang: "ko", outputLang: "en" }, "cloud-masked", "patterns", false],
    ["ready, letter language unknown", { letterLang: "unknown" }, "device", "device+patterns", false],
    ["downloadable, short", { device: "downloadable" }, "cloud-masked", "patterns", true],
    ["downloading, short", { device: "downloading" }, "cloud-masked", "patterns", true],
    ["downloading, offline", { device: "downloading", online: false }, "local-only", "patterns", true],
    ["downloadable, too long", { device: "downloadable", estTokens: 9000 }, "cloud-masked", "patterns", false],
    ["unavailable (hardware)", { device: "unavailable" }, "cloud-masked", "patterns", false],
    ["no Prompt API", { device: "no-api" }, "cloud-masked", "patterns", false],
    ["no Prompt API, offline", { device: "no-api", online: false }, "local-only", "patterns", false],
    ["exactly at budget", { estTokens: 6000 }, "device", "device+patterns", false],
    ["one over budget", { estTokens: 6001 }, "cloud-masked", "device+patterns", false],
  ];
  it.each(rows)("%s", (_name, over, path, masker, after) => {
    const r = decideRoute({ ...base, ...over });
    expect(r.path).toBe(path);
    expect(r.masker).toBe(masker);
    expect(r.deviceAfterDownload).toBe(after);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("never routes raw text anywhere but the device", () => {
    const states: DeviceState[] = ["available", "downloadable", "downloading", "unavailable", "no-api"];
    for (const device of states)
      for (const online of [true, false])
        for (const estTokens of [10, 99999])
          for (const outputLang of ["en", "ko"]) {
            const r = decideRoute({ ...base, device, online, estTokens, outputLang });
            // The only paths are device (raw stays local), cloud-masked (masked + confirmed), local-only (nothing leaves).
            expect(["device", "cloud-masked", "local-only"]).toContain(r.path);
            if (r.path === "device") expect(device).toBe("available");
            if (r.path === "cloud-masked") expect(online).toBe(true);
          }
  });
});

describe("language and size", () => {
  it("guesses the sample languages", () => {
    expect(SAMPLES.map((s) => guessLanguage(s.text))).toEqual(SAMPLES.map((s) => s.language));
    expect(guessLanguage("국민건강보험공단에서 알려드립니다. 납부 기한은 12월 1일입니다.")).toBe("ko");
    expect(guessLanguage("お支払い期限は12月1日です。")).toBe("ja");
  });
  it("puts the long sample over the device budget and the others under", () => {
    for (const s of SAMPLES) {
      const t = estimateTokens(s.text);
      if (s.id === "benefit") expect(t).toBeGreaterThan(6000);
      else expect(t).toBeLessThan(1000);
    }
  });
});
