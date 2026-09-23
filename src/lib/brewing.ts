import type {
  AdditionStage,
  BrewStatus,
  IngredientType,
  StepType,
} from "@/generated/prisma/enums";

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

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

/** Returns an error message if the gravity pair is impossible, otherwise null. */
export function validateGravity(og: number | null, fg: number | null) {
  for (const [name, v] of [["OG", og], ["FG", fg]] as const) {
    if (v != null && (v < 0.99 || v > 1.2)) return `${name} ${v} looks wrong — expected e.g. 1.050`;
  }
  if (og != null && fg != null && fg >= og) return "FG must be lower than OG (values swapped?)";
  return null;
}
