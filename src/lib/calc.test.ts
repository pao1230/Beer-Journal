import { describe, expect, it } from "vitest";
import {
  brewhouseEfficiency,
  calcRecipe,
  convertUnit,
  moreySrm,
  primingSugar,
  residualCo2,
  tinsethUtilisation,
  waterProfile,
  type CalcIngredient,
} from "./calc";

const ing = (p: Partial<CalcIngredient>): CalcIngredient => ({
  name: "x",
  type: "OTHER",
  amount: 0,
  unit: "g",
  stage: "BOIL",
  additionTime: null,
  alphaAcid: null,
  color: null,
  potential: null,
  attenuation: null,
  waterSalt: null,
  ...p,
});

const paleAle = ing({ name: "Pale Ale", type: "GRAIN", amount: 4.2, unit: "kg", stage: "MASH", potential: 1.038, color: 3 });

describe("Tinseth", () => {
  it("matches the published utilisation table (1.050, 60 min ≈ 0.231)", () => {
    expect(tinsethUtilisation(1.05, 60)).toBeCloseTo(0.231, 3);
  });
  it("gives ~31 IBU for 28 g of 12.5% AA at 60 min in 21 L at 1.074", () => {
    const r = calcRecipe({
      batchSize: 20,
      targetOg: 1.074,
      efficiency: 72,
      trubLoss: 1,
      mashWaterL: null,
      spargeWaterL: null,
      ingredients: [ing({ name: "Magnum", type: "HOP", amount: 28, unit: "g", additionTime: 60, alphaAcid: 12.5 })],
    });
    expect(r.ibu).toBeCloseTo(31, 0);
  });
  it("ignores whirlpool and dry hops", () => {
    const r = calcRecipe({
      batchSize: 20, targetOg: 1.05, efficiency: 72, trubLoss: 0, mashWaterL: null, spargeWaterL: null,
      ingredients: [
        ing({ type: "HOP", stage: "WHIRLPOOL", amount: 50, additionTime: 20, alphaAcid: 12 }),
        ing({ type: "HOP", stage: "DRY_HOP", amount: 50, additionTime: 3, alphaAcid: 12 }),
      ],
    });
    expect(r.ibu).toBeNull();
  });
});

describe("gravity and color", () => {
  const base = { batchSize: 20, targetOg: null, efficiency: 72, trubLoss: 0, mashWaterL: null, spargeWaterL: null };
  it("estimates OG from potential and efficiency", () => {
    // 4.2 kg × 2.20462 lb × 38 ppg × 72% / 5.283 gal ≈ 48 points
    expect(calcRecipe({ ...base, ingredients: [paleAle] }).og).toBeCloseTo(1.048, 3);
  });
  it("estimates FG from yeast attenuation", () => {
    const r = calcRecipe({ ...base, ingredients: [paleAle, ing({ type: "YEAST", unit: "pkg", amount: 1, attenuation: 75 })] });
    expect(r.fg).toBeCloseTo(1 + (r.og! - 1) * 0.25, 6);
  });
  it("uses Morey for SRM", () => {
    expect(moreySrm(10)).toBeCloseTo(7.24, 2);
  });
  it("warns about grains without potential and assumed efficiency", () => {
    const r = calcRecipe({ ...base, efficiency: null, ingredients: [ing({ name: "Mystery malt", type: "GRAIN", amount: 1, unit: "kg" })] });
    expect(r.og).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/Mystery malt/);
    expect(r.warnings.join(" ")).toMatch(/72% efficiency is assumed/);
  });
  it("computes actual brewhouse efficiency", () => {
    expect(brewhouseEfficiency(1.048, 20, [paleAle])).toBeCloseTo(72, 0);
    expect(brewhouseEfficiency(null, 20, [paleAle])).toBeNull();
  });
});

describe("water profile", () => {
  it("adds ions per litre of total water", () => {
    const w = waterProfile({
      mashWaterL: 17.8,
      spargeWaterL: 7.2,
      ingredients: [ing({ type: "WATER", amount: 3, unit: "g", stage: "MASH", waterSalt: "CaCl2" })],
    });
    expect(w!.ppm.Ca).toBeCloseTo(32.7, 1);
    expect(w!.ppm.Cl).toBeCloseTo(57.9, 1);
    expect(w!.sulfateToChloride).toBe(0);
  });
  it("needs water volumes and known salts", () => {
    expect(waterProfile({ mashWaterL: null, spargeWaterL: null, ingredients: [] })).toBeNull();
  });
});

describe("priming sugar", () => {
  it("knows residual CO2 after fermenting at 20°C", () => {
    expect(residualCo2(20)).toBeCloseTo(0.86, 2);
  });
  it("gives ~123 g dextrose for 20 L at 2.4 vol, 20°C", () => {
    expect(primingSugar(20, 2.4, 20, "dextrose")).toBeCloseTo(123, 0);
  });
  it("never goes negative", () => {
    expect(primingSugar(20, 0.5, 10, "sucrose")).toBe(0);
  });
});

it("converts compatible units only", () => {
  expect(convertUnit(1.5, "kg", "g")).toBe(1500);
  expect(convertUnit(250, "ml", "L")).toBe(0.25);
  expect(convertUnit(1, "kg", "L")).toBeNull();
  expect(convertUnit(2, "pkg", "pkg")).toBe(2);
});

describe("sugars and lactose", () => {
  const base = { batchSize: 20, targetOg: null, efficiency: 72, trubLoss: 0, mashWaterL: null, spargeWaterL: null };
  const lactose = ing({ name: "Lactose", type: "OTHER", amount: 500, unit: "g", stage: "BOIL", potential: 1.035, unfermentable: true });
  const yeast = ing({ type: "YEAST", unit: "pkg", amount: 1, attenuation: 80 });

  it("adds kettle sugars at 100% and keeps unfermentables in FG", () => {
    const without = calcRecipe({ ...base, ingredients: [paleAle, yeast] });
    const withLactose = calcRecipe({ ...base, ingredients: [paleAle, yeast, lactose] });
    // 0.5 kg × 2.20462 × 35 / 5.283 gal ≈ 7.3 points, none of it fermented
    const pts = (withLactose.og! - without.og!) * 1000;
    expect(pts).toBeCloseTo(7.3, 1);
    expect((withLactose.fg! - without.fg!) * 1000).toBeCloseTo(pts, 6);
  });
  it("leaves kettle sugar out of mash efficiency", () => {
    const og = calcRecipe({ ...base, ingredients: [paleAle, lactose] }).og!;
    expect(brewhouseEfficiency(og, 20, [paleAle, lactose])).toBeCloseTo(72, 1);
  });
});
