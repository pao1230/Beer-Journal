import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecipeText } from "./parse-text";

const line = (i: { type: string; name: string; amount: number; unit: string; stage: string; additionTime: number | null }) =>
  `${i.type} ${i.name} ${i.amount} ${i.unit} ${i.stage}${i.additionTime == null ? "" : `@${i.additionTime}`}`;

describe("parseRecipeText — Thai/English PDF recipe sheet", () => {
  // Text as the import screen extracts it from "Citra & Simcoe IPA (No Crystal) 20L" (two pages).
  const text = readFileSync(new URL("./fixtures/citra-simcoe-ipa.txt", import.meta.url), "utf8");
  const { data, checks } = parseRecipeText(text);

  it("reads the header and targets", () => {
    expect(data).toMatchObject({
      name: "Citra & Simcoe IPA",
      style: "American IPA",
      batchSize: 20,
      boilTime: 60,
      targetOg: 1.06,
      targetFg: 1.009,
      targetIbu: 58,
      targetCarbonation: 2.5,
      mashWaterL: 15.6,
      spargeWaterL: 13.5,
    });
  });

  it("reads every addition with its stage and timing, not the totals table", () => {
    expect(data.ingredients.map(line)).toEqual([
      "GRAIN Pale Ale Malt 5.2 kg MASH",
      "YEAST SafAle US-05 1 pkg FERMENTATION",
      "HOP Simcoe 15 g BOIL@60",
      "HOP Citra 10 g BOIL@15",
      "HOP Simcoe 10 g BOIL@15",
      "HOP Citra 15 g WHIRLPOOL@0",
      "HOP Simcoe 15 g WHIRLPOOL@0",
      "HOP Citra 25 g DRY_HOP@7",
      "HOP Simcoe 25 g DRY_HOP@7",
    ]);
    expect(data.ingredients[1].notes).toBe("or BRY-97");
    expect(data.ingredients[5].notes).toContain("80-85°C");
  });

  it("reads the mash and fermentation plan", () => {
    expect(data.mashSteps).toEqual([
      { name: "Mashing", temperature: 65, timeMin: 60 },
      { name: "Mash Out", temperature: 75, timeMin: 10 },
    ]);
    expect(data.fermentationSteps.map((f) => [f.name, f.temperature, f.days])).toEqual([
      ["Primary", 19, 7],
      ["Dry hop", 19, 4],
      ["Cold crash", 3, 2],
    ]);
  });

  it("keeps the highlights and the original ranges in the notes", () => {
    expect(data.notes).toContain("สีสว่างสะอาดตา");
    expect(data.notes).toContain("Ranges in the original: FG 1.008–1.010, IBU 55–60");
  });

  it("flags what it guessed, including the sheet's own Simcoe total not adding up", () => {
    const keys = checks.map((c) => c.vars?.field ?? c.vars?.name ?? c.key);
    expect(keys).toEqual(expect.arrayContaining(["FG", "IBU", "Sparge water", "Primary", "Dry hop", "Cold crash", "SafAle US-05"]));
    expect(checks).toContainEqual(expect.objectContaining({ vars: { name: "Simcoe Hop", sum: 65, total: 50 } }));
  });
});

describe("parseRecipeText — pasted plain text", () => {
  it("reads a short English recipe", () => {
    const { data, checks } = parseRecipeText(
      [
        "Recipe: Galaxy Pale",
        "Batch size: 23 L, OG 1.050, FG 1.011, 35 IBU, 5 SRM",
        "Pilsner Malt 4 kg",
        "Munich 0.5 kg",
        "Magnum 10g @ 60 min",
        "Galaxy 30 g 10 min",
        "Whirlpool: Galaxy 40 g",
        "Mash 66°C 60 min",
        "Ferment at 19°C for 10 days",
        "Dry hop Galaxy 50 g day 5",
        "US-05 1 pack",
        "Carbonation 2.4 vol",
      ].join("\n"),
    );
    expect(data).toMatchObject({ name: "Galaxy Pale", batchSize: 23, targetOg: 1.05, targetFg: 1.011, targetIbu: 35, targetSrm: 5, targetCarbonation: 2.4 });
    expect(data.ingredients.map(line)).toEqual([
      "GRAIN Pilsner Malt 4 kg MASH",
      "GRAIN Munich 0.5 kg MASH",
      "HOP Magnum 10 g BOIL@60",
      "HOP Galaxy 30 g BOIL@10",
      "HOP Galaxy 40 g WHIRLPOOL@0",
      "HOP Galaxy 50 g DRY_HOP@5",
      "YEAST US-05 1 pkg FERMENTATION",
    ]);
    expect(data.mashSteps).toEqual([{ name: "Mash", temperature: 66, timeMin: 60 }]);
    expect(data.fermentationSteps.map((f) => [f.name, f.temperature, f.days])).toEqual([["Primary", 19, 10]]);
    expect(checks.find((c) => c.key.startsWith("No batch size"))).toBeUndefined();
  });

  it("says so when it finds nothing", () => {
    const { data, checks } = parseRecipeText("hello");
    expect(data.ingredients).toEqual([]);
    expect(checks.map((c) => c.key)).toContain("No ingredients found — add them in the editor below");
  });
});
