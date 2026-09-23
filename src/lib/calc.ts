import type { AdditionStage, IngredientType } from "@/generated/prisma/enums";

const LB_PER_KG = 2.20462;
const GAL_PER_L = 0.264172;
export const DEFAULT_EFFICIENCY = 72;

/** Converts a mass to kilograms; null for non-mass units. */
export function toKg(amount: number, unit: string) {
  if (unit === "kg") return amount;
  if (unit === "g") return amount / 1000;
  return null;
}

const UNIT_FAMILY: Record<string, { family: string; factor: number }> = {
  kg: { family: "mass", factor: 1000 },
  g: { family: "mass", factor: 1 },
  L: { family: "volume", factor: 1000 },
  ml: { family: "volume", factor: 1 },
  pkg: { family: "pkg", factor: 1 },
  item: { family: "item", factor: 1 },
  tsp: { family: "tsp", factor: 1 },
};

/** Converts between compatible units (kg↔g, L↔ml); null if they can't be compared. */
export function convertUnit(amount: number, from: string, to: string) {
  const a = UNIT_FAMILY[from];
  const b = UNIT_FAMILY[to];
  if (!a || !b || a.family !== b.family) return null;
  return (amount * a.factor) / b.factor;
}

// mg/L added by 1 g of salt in 1 L of water.
export const WATER_SALTS: Record<string, { label: string; ions: Partial<Record<Ion, number>> }> = {
  CaCl2: { label: "Calcium chloride (CaCl₂·2H₂O)", ions: { Ca: 272.6, Cl: 482.3 } },
  CaSO4: { label: "Gypsum (CaSO₄·2H₂O)", ions: { Ca: 232.8, SO4: 557.7 } },
  MgSO4: { label: "Epsom salt (MgSO₄·7H₂O)", ions: { Mg: 98.6, SO4: 389.6 } },
  NaHCO3: { label: "Baking soda (NaHCO₃)", ions: { Na: 273.7, HCO3: 726.4 } },
  CaCO3: { label: "Chalk (CaCO₃)", ions: { Ca: 400.4, HCO3: 1219.2 } },
  NaCl: { label: "Table salt (NaCl)", ions: { Na: 393.4, Cl: 606.6 } },
};
export const IONS = ["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"] as const;
export type Ion = (typeof IONS)[number];

export type CalcIngredient = {
  name: string;
  type: IngredientType | null;
  amount: number;
  unit: string;
  stage: AdditionStage;
  additionTime: number | null;
  alphaAcid: number | null;
  color: number | null;
  potential: number | null;
  attenuation: number | null;
  waterSalt: string | null;
  unfermentable?: boolean;
};

export type CalcInput = {
  batchSize: number;
  targetOg: number | null;
  efficiency: number | null;
  trubLoss: number | null;
  mashWaterL: number | null;
  spargeWaterL: number | null;
  ingredients: CalcIngredient[];
};

/** Tinseth utilisation for one boil addition. */
export function tinsethUtilisation(boilGravity: number, minutes: number) {
  const bigness = 1.65 * 0.000125 ** (boilGravity - 1);
  const time = (1 - Math.exp(-0.04 * minutes)) / 4.15;
  return bigness * time;
}

/** Morey: SRM from malt color units. */
export function moreySrm(mcu: number) {
  return mcu <= 0 ? 0 : 1.4922 * mcu ** 0.6859;
}

/**
 * Gravity points (points · lb, i.e. per gallon) at 100% extraction. Mashed ingredients go
 * through the mash and lose efficiency; sugars and lactose added to the kettle don't.
 */
function gravityUnits(ingredients: CalcIngredient[]) {
  const out = { mash: 0, kettle: 0, unfermentableMash: 0, unfermentableKettle: 0 };
  for (const i of ingredients) {
    if ((i.type !== "GRAIN" && i.type !== "OTHER") || i.potential == null) continue;
    const kg = toKg(i.amount, i.unit);
    if (kg == null) continue;
    const gu = (i.potential - 1) * 1000 * kg * LB_PER_KG;
    const mashed = i.stage === "MASH";
    if (mashed) out.mash += gu;
    else out.kettle += gu;
    if (i.unfermentable) {
      if (mashed) out.unfermentableMash += gu;
      else out.unfermentableKettle += gu;
    }
  }
  return out;
}

/** English template + values; the UI translates it. */
export type CalcWarning = { key: string; vars?: Record<string, string | number> };

export function calcRecipe(input: CalcInput) {
  const warnings: CalcWarning[] = [];
  const gal = input.batchSize * GAL_PER_L;
  const grains = input.ingredients.filter((i) => i.type === "GRAIN");

  const missingPotential = grains.filter((g) => g.potential == null).map((g) => g.name);
  if (missingPotential.length) {
    warnings.push({ key: "No potential set for {names} — left out of OG.", vars: { names: missingPotential.join(", ") } });
  }
  const efficiency = input.efficiency ?? DEFAULT_EFFICIENCY;
  if (input.efficiency == null) {
    warnings.push({ key: "No equipment profile, so {n}% efficiency is assumed.", vars: { n: DEFAULT_EFFICIENCY } });
  }

  const gu = gravityUnits(input.ingredients);
  const unfermentablePts = gal > 0 ? (gu.unfermentableMash * (efficiency / 100) + gu.unfermentableKettle) / gal / 1000 : 0;
  const totalGu = gu.mash * (efficiency / 100) + gu.kettle;
  const og = totalGu > 0 && gal > 0 ? 1 + totalGu / gal / 1000 : null;

  const yeast = input.ingredients.find((i) => i.type === "YEAST" && i.attenuation != null);
  const fg =
    og != null && yeast ? 1 + (og - 1 - unfermentablePts) * (1 - yeast.attenuation! / 100) + unfermentablePts : null;
  if (input.ingredients.some((i) => i.waterSalt === "CaCO3")) {
    warnings.push({ key: "Chalk (CaCO₃) barely dissolves without acid; its calcium and bicarbonate are shown as if fully dissolved." });
  }

  // IBU: Tinseth with OG as boil gravity, over the post-boil volume.
  const boilGravity = input.targetOg ?? og ?? 1.05;
  const postBoilL = input.batchSize + (input.trubLoss ?? 0);
  let ibu: number | null = null;
  for (const h of input.ingredients) {
    if (h.type !== "HOP" || h.stage !== "BOIL" || h.additionTime == null || h.additionTime <= 0) continue;
    const kg = toKg(h.amount, h.unit);
    if (kg == null || h.alphaAcid == null) {
      warnings.push({ key: "{name}: needs alpha acid and a weight to count toward IBU.", vars: { name: h.name } });
      continue;
    }
    const mgPerL = ((h.alphaAcid / 100) * kg * 1_000_000) / postBoilL;
    ibu = (ibu ?? 0) + tinsethUtilisation(boilGravity, h.additionTime) * mgPerL;
  }

  let mcu = 0;
  let anyColor = false;
  for (const g of grains) {
    const kg = toKg(g.amount, g.unit);
    if (kg == null || g.color == null) continue;
    anyColor = true;
    mcu += (g.color * kg * LB_PER_KG) / gal;
  }
  const srm = anyColor && gal > 0 ? moreySrm(mcu) : null;

  return { og, fg, abv: og != null && fg != null ? (og - fg) * 131.25 : null, ibu, srm, efficiency, warnings, water: waterProfile(input) };
}

/** Ion concentrations (ppm) from salt additions, assuming RO/distilled base water. */
export function waterProfile(input: Pick<CalcInput, "mashWaterL" | "spargeWaterL" | "ingredients">) {
  const litres = (input.mashWaterL ?? 0) + (input.spargeWaterL ?? 0);
  const salts = input.ingredients.filter((i) => i.type === "WATER" && i.waterSalt && WATER_SALTS[i.waterSalt]);
  if (salts.length === 0 || litres <= 0) return null;
  const ppm = Object.fromEntries(IONS.map((ion) => [ion, 0])) as Record<Ion, number>;
  for (const s of salts) {
    const grams = convertUnit(s.amount, s.unit, "g");
    if (grams == null) continue;
    for (const [ion, factor] of Object.entries(WATER_SALTS[s.waterSalt!].ions)) ppm[ion as Ion] += (grams * factor!) / litres;
  }
  return { ppm, litres, sulfateToChloride: ppm.Cl > 0 ? ppm.SO4 / ppm.Cl : null };
}

/** Actual brewhouse efficiency (%) from measured OG and volume into the fermenter. */
export function brewhouseEfficiency(actualOg: number | null, volumeL: number | null, ingredients: CalcIngredient[]) {
  if (actualOg == null || volumeL == null || volumeL <= 0) return null;
  const gu = gravityUnits(ingredients);
  if (gu.mash <= 0) return null;
  const fromMash = (actualOg - 1) * 1000 * volumeL * GAL_PER_L - gu.kettle;
  return (fromMash / gu.mash) * 100;
}

/** CO2 (volumes) still dissolved in beer after fermenting at this temperature. */
export function residualCo2(tempC: number) {
  const f = (tempC * 9) / 5 + 32;
  return 3.0378 - 0.050062 * f + 0.00026555 * f * f;
}

export const PRIMING_SUGARS = {
  dextrose: { label: "Dextrose (corn sugar)", gramsPerLitreVol: 4.0 },
  sucrose: { label: "Table sugar (sucrose)", gramsPerLitreVol: 3.82 },
} as const;

/** Grams of priming sugar for a target carbonation; 0 if the beer is already carbonated enough. */
export function primingSugar(volumeL: number, targetCo2: number, maxFermentTempC: number, sugar: keyof typeof PRIMING_SUGARS) {
  const needed = Math.max(0, targetCo2 - residualCo2(maxFermentTempC));
  return needed * volumeL * PRIMING_SUGARS[sugar].gramsPerLitreVol;
}
