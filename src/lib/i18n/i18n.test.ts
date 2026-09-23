import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage, translate } from "./core";
import { th } from "./th";
import { gravityWarnings, INGREDIENT_TYPES, PACKAGING_METHODS, STAGES, STATUSES, STEPS, tempWarning } from "@/lib/brewing";
import { PRIMING_SUGARS, WATER_SALTS } from "@/lib/calc";

describe("translate", () => {
  it("returns English keys as they are", () => {
    expect(translate("en", "Save")).toBe("Save");
  });
  it("uses the Thai text and fills placeholders", () => {
    expect(translate("th", "Save")).toBe("บันทึก");
    expect(translate("th", "Day {n}", { n: 3 })).toBe("วันที่ 3");
    expect(translate("en", "Day {n}", { n: 3 })).toBe("Day 3");
  });
  it("falls back to English for unknown text such as user data", () => {
    expect(translate("th", "My Sweet Stout")).toBe("My Sweet Stout");
  });
  it("leaves unknown placeholders alone", () => {
    expect(translate("en", "{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});

describe("localeFromAcceptLanguage", () => {
  it("picks Thai when the browser prefers it", () => {
    expect(localeFromAcceptLanguage("th-TH,th;q=0.9,en;q=0.8")).toBe("th");
    expect(localeFromAcceptLanguage("en;q=0.5,th;q=0.9")).toBe("th");
  });
  it("defaults to English", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,th;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("fr-FR")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });
});

/** Every literal passed to t()/tr() plus UI labels and user-facing errors in the source. */
function sourceKeys() {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name !== "generated") walk(p);
      } else if (/\.tsx?$/.test(f.name) && !f.name.includes(".test.") && !p.includes(path.join("i18n", "th.ts"))) files.push(p);
    }
  })(path.resolve(__dirname, "../.."));
  const lit = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'`;
  const patterns = [
    String.raw`\b(?:t|tr)\(\s*(?:${lit})`,
    String.raw`\blabel: (?:${lit})`,
    String.raw`new (?:UserError|Error)\(\s*(?:${lit})`,
    String.raw`\brequired\((?:[^()]|\([^()]*\))*?, (?:${lit})\)`,
  ].map((p) => new RegExp(p, "g"));
  const keys = new Set<string>();
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const re of patterns) for (const m of src.matchAll(re)) keys.add((m[1] ?? m[2]).replace(/\\(.)/g, "$1"));
  }
  return keys;
}

// Kept in English on purpose: abbreviations, sample data and developer-only errors.
const UNTRANSLATED = new Set(["OG", "FG", "ABV", "IBU", "SRM", "CO2", "pH", "IBU (Tinseth)", "SRM (Morey)", "m1", "m2", "DATABASE_URL is not set"]);

describe("Thai translations", () => {
  it("cover every UI string in the source", () => {
    const missing = [...sourceKeys()].filter((k) => !UNTRANSLATED.has(k) && !(k in th));
    expect(missing).toEqual([]);
  });

  it("cover labels and messages built at runtime", () => {
    const deviations = [
      ...gravityWarnings({ targetOg: 1.05, targetFg: 1.01, actualOg: 1.06, actualFg: 1.02 }),
      ...gravityWarnings({ targetOg: 1.05, targetFg: 1.01, actualOg: 1.04, actualFg: 1.0 }),
      tempWarning("Mash temp", 66, 70)!,
      tempWarning("Mash temp", 66, 62)!,
    ].map((w) => w.message);
    const keys = [
      ...deviations,
      "pH higher than target",
      "pH lower than target",
      "Post-boil gravity higher than target OG",
      "Post-boil gravity lower than target OG",
      "{n} log entry",
      "{n} log entries",
      "None",
      "Low",
      "Medium",
      "High",
      "Purchase",
      "Stock count",
      "Used in brew",
      ...PACKAGING_METHODS,
      ...[INGREDIENT_TYPES, STAGES, STATUSES, STEPS].flat().map((x) => x.label),
      ...STEPS.flatMap((s) => s.presets.map((p) => p.type)).filter((k) => !UNTRANSLATED.has(k)),
      ...Object.values(WATER_SALTS).map((s) => s.label),
      ...Object.values(PRIMING_SUGARS).map((s) => s.label),
    ];
    expect(keys.filter((k) => !(k in th))).toEqual([]);
  });

  it("keep every placeholder of the English text", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const broken = Object.entries(th).filter(([en, text]) => vars(en).join() !== vars(text).join());
    expect(broken).toEqual([]);
  });
});
