import type {
  AdditionStage,
  BrewStatus,
  IngredientType,
  StepType,
} from "@/generated/prisma/enums";
import { UserError } from "@/lib/user-error";

export const INGREDIENT_TYPES: { value: IngredientType; label: string }[] = [
  { value: "GRAIN", label: "Grain" },
  { value: "HOP", label: "Hop" },
  { value: "YEAST", label: "Yeast" },
  { value: "WATER", label: "Water agent" },
  { value: "OTHER", label: "Other" },
];

export const STAGES: { value: AdditionStage; label: string }[] = [
  { value: "MASH", label: "Mash" },
  { value: "SPARGE", label: "Sparge" },
  { value: "BOIL", label: "Boil" },
  { value: "WHIRLPOOL", label: "Whirlpool" },
  { value: "FERMENTATION", label: "Fermentation" },
  { value: "DRY_HOP", label: "Dry hop" },
  { value: "PACKAGING", label: "Packaging" },
];

export const DEFAULT_STAGE: Record<IngredientType, AdditionStage> = {
  GRAIN: "MASH",
  HOP: "BOIL",
  YEAST: "FERMENTATION",
  WATER: "MASH",
  OTHER: "BOIL",
};

export const UNITS = ["kg", "g", "L", "ml", "pkg", "tsp", "item"];

export const DEFAULT_UNIT: Record<IngredientType, string> = {
  GRAIN: "kg",
  HOP: "g",
  YEAST: "pkg",
  WATER: "g",
  OTHER: "g",
};

export const STATUSES: { value: BrewStatus; label: string }[] = [
  { value: "PLANNING", label: "Planning" },
  { value: "BREWING", label: "Brewing" },
  { value: "FERMENTING", label: "Fermenting" },
  { value: "CONDITIONING", label: "Conditioning" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export type MeasurementPreset = { type: string; unit?: string; step?: string };

export const STEPS: {
  type: StepType;
  slug: string;
  label: string;
  presets: MeasurementPreset[];
}[] = [
  {
    type: "WATER_PREP",
    slug: "water-prep",
    label: "Water Preparation",
    presets: [
      { type: "Total water", unit: "L", step: "0.1" },
      { type: "pH", step: "0.01" },
      { type: "Water temp", unit: "°C", step: "0.1" },
    ],
  },
  {
    type: "MASHING",
    slug: "mashing",
    label: "Mashing",
    presets: [
      { type: "Mash temp", unit: "°C", step: "0.1" },
      { type: "Mash time", unit: "min", step: "1" },
      { type: "Mash out temp", unit: "°C", step: "0.1" },
      { type: "Pre-mash pH", step: "0.01" },
      { type: "Post-mash pH", step: "0.01" },
      { type: "First runoff SG", step: "0.001" },
    ],
  },
  {
    type: "SPARGING",
    slug: "sparging",
    label: "Sparging",
    presets: [
      { type: "Sparge volume", unit: "L", step: "0.1" },
      { type: "Sparge temp", unit: "°C", step: "0.1" },
      { type: "Runoff SG", step: "0.001" },
      { type: "Runoff pH", step: "0.01" },
    ],
  },
  {
    type: "BOILING",
    slug: "boiling",
    label: "Boiling",
    presets: [
      { type: "Pre-boil volume", unit: "L", step: "0.1" },
      { type: "Pre-boil SG", step: "0.001" },
      { type: "Post-boil volume", unit: "L", step: "0.1" },
      { type: "Post-boil SG", step: "0.001" },
      { type: "Boil time", unit: "min", step: "1" },
    ],
  },
  {
    type: "COOLING",
    slug: "cooling",
    label: "Cooling",
    presets: [
      { type: "Pitch temp", unit: "°C", step: "0.1" },
      { type: "Cooling time", unit: "min", step: "1" },
    ],
  },
  {
    type: "FERMENTATION",
    slug: "fermentation",
    label: "Fermentation",
    presets: [{ type: "Ferment temp", unit: "°C", step: "0.1" }],
  },
  {
    type: "PACKAGING",
    slug: "packaging",
    label: "Packaging",
    presets: [
      { type: "Final volume", unit: "L", step: "0.1" },
      { type: "Carbonation", unit: "vol CO2", step: "0.1" },
      { type: "Priming sugar", unit: "g", step: "1" },
    ],
  },
];

export const PACKAGING_METHODS = ["Bottle-condition", "Keg (force carb)", "Keg (natural)", "Other"];

export function stepBySlug(slug: string) {
  return STEPS.find((s) => s.slug === slug);
}

export function stepByType(type: StepType) {
  return STEPS.find((s) => s.type === type)!;
}

export function labelOf<T extends string>(list: { value: T; label: string }[], value: T) {
  return list.find((i) => i.value === value)?.label ?? value;
}

export function abv(og: number | null | undefined, fg: number | null | undefined) {
  if (og == null || fg == null) return null;
  return (og - fg) * 131.25;
}

export function fmtSg(sg: number | null | undefined) {
  return sg == null ? "–" : sg.toFixed(3);
}

export function fmtAbv(value: number | null) {
  return value == null ? "–" : `${value.toFixed(1)}%`;
}

export function fmtNum(n: number | null | undefined, unit?: string) {
  if (n == null) return "–";
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
  return unit ? `${s} ${unit}` : s;
}

export function fmtDate(d: Date, locale: "en" | "th" = "en") {
  return locale === "th"
    ? d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function batchLabel(recipeName: string, batchNumber: number) {
  return `${recipeName} #${String(batchNumber).padStart(3, "0")}`;
}

/** Volume expected in the kettle before the boil, from the equipment profile. */
export function preBoilVolume(
  batchSize: number,
  boilTimeMin: number,
  equipment: { boilOffRate: number; trubLoss: number } | null,
) {
  if (!equipment) return null;
  return batchSize + equipment.trubLoss + (equipment.boilOffRate * boilTimeMin) / 60;
}

export type Deviation = { label: string; target: string; actual: string; message: string };

export function gravityWarnings(input: {
  targetOg: number | null;
  targetFg: number | null;
  actualOg: number | null;
  actualFg: number | null;
}): Deviation[] {
  const out: Deviation[] = [];
  const { targetOg, targetFg, actualOg, actualFg } = input;
  if (targetOg != null && actualOg != null && Math.abs(actualOg - targetOg) > 0.005) {
    out.push({
      label: "OG",
      target: fmtSg(targetOg),
      actual: fmtSg(actualOg),
      message: `OG ${actualOg > targetOg ? "higher" : "lower"} than target`,
    });
  }
  if (targetFg != null && actualFg != null && Math.abs(actualFg - targetFg) > 0.005) {
    out.push({
      label: "FG",
      target: fmtSg(targetFg),
      actual: fmtSg(actualFg),
      message: `FG ${actualFg > targetFg ? "higher" : "lower"} than target`,
    });
  }
  return out;
}

export function tempWarning(label: string, target: number, actual: number): Deviation | null {
  if (Math.abs(actual - target) <= 2) return null;
  return {
    label,
    target: `${target}°C`,
    actual: `${actual}°C`,
    message: `${label} ${actual > target ? "higher" : "lower"} than target`,
  };
}

/** Returns an error if the gravity pair is impossible, otherwise null. */
export function validateGravity(og: number | null, fg: number | null, names: [og: string, fg: string] = ["OG", "FG"]) {
  for (const [name, value] of [[names[0], og], [names[1], fg]] as const) {
    if (value != null && (value < 0.99 || value > 1.2)) {
      return new UserError("{name} {value} looks wrong — expected e.g. 1.050", { name, value });
    }
  }
  if (og != null && fg != null && fg >= og) {
    return new UserError("{fg} must be lower than {og} (values swapped?)", { og: names[0], fg: names[1] });
  }
  return null;
}

const DAY_MS = 86_400_000;

export function daysSince(start: Date, date: Date) {
  return Math.round((date.getTime() - start.getTime()) / DAY_MS);
}

type LogPoint = { date: Date; gravity: number | null; temperature: number | null; ph: number | null };

/** Splits a fermentation log into per-day series; OG counts as the day-0 gravity reading. */
export function fermentationSeries(brewDate: Date, actualOg: number | null, logs: LogPoint[]) {
  const pick = (key: "gravity" | "temperature" | "ph") =>
    logs.flatMap((l) => (l[key] == null ? [] : [{ x: daysSince(brewDate, l.date), y: l[key]! }]));
  const gravity = pick("gravity");
  if (actualOg != null && !gravity.some((p) => p.x <= 0)) gravity.unshift({ x: 0, y: actualOg });
  return { gravity, temperature: pick("temperature"), ph: pick("ph") };
}

/** Apparent attenuation in %, e.g. OG 1.072 → FG 1.026 is 63.9%. */
export function attenuation(og: number | null | undefined, fg: number | null | undefined) {
  if (og == null || fg == null || og <= 1) return null;
  return ((og - fg) / (og - 1)) * 100;
}

/** Rounds a scaled amount to something you can actually weigh or count. */
export function roundAmount(value: number, unit: string) {
  if (unit === "pkg" || unit === "item") return Math.max(1, Math.ceil(value - 1e-9));
  if (unit === "tsp") return Math.max(0.25, Math.round(value * 4) / 4);
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Scales mash/sparge water to a new batch size. Mash water keeps its thickness (scales with
 * grain); losses that don't depend on batch size (boil-off, trub, deadspace) stay fixed and
 * are absorbed by the sparge.
 */
export function scaleWater(
  input: { mashWaterL: number | null; spargeWaterL: number | null; boilTime: number },
  equipment: { boilOffRate: number; trubLoss: number; mashTunDeadspace: number } | null,
  ratio: number,
) {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const { mashWaterL: mash, spargeWaterL: sparge } = input;
  if (mash == null || sparge == null || !equipment) {
    return { mashWaterL: mash == null ? null : r1(mash * ratio), spargeWaterL: sparge == null ? null : r1(sparge * ratio) };
  }
  const fixed = (equipment.boilOffRate * input.boilTime) / 60 + equipment.trubLoss + equipment.mashTunDeadspace;
  const total = mash + sparge;
  const newTotal = Math.max(0, total - fixed) * ratio + fixed;
  const newMash = mash * ratio;
  return { mashWaterL: r1(newMash), spargeWaterL: r1(Math.max(0, newTotal - newMash)) };
}
