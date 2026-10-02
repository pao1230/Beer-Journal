import { z } from "zod";
import { roundAmount, scaleWater } from "@/lib/brewing";

/**
 * The app's own recipe file: a whole recipe version, self-contained (ingredient names and specs
 * instead of database ids), so it can be imported into any Brewing Journal.
 */
export const RECIPE_FILE_FORMAT = "brewing-journal-recipe";

const n = z.number().finite().nullish().transform((v) => v ?? null);
const s = z.string().nullish().transform((v) => v ?? null);

export const ingredientType = z.enum(["GRAIN", "HOP", "YEAST", "WATER", "OTHER"]);
export const additionStage = z.enum(["MASH", "SPARGE", "BOIL", "WHIRLPOOL", "FERMENTATION", "DRY_HOP", "PACKAGING"]);

const fileIngredient = z.object({
  name: z.string().trim().min(1),
  type: ingredientType,
  brand: s,
  amount: z.number().positive(),
  unit: z.string().min(1),
  stage: additionStage,
  additionTime: n,
  notes: s,
  alphaAcid: n,
  color: n,
  potential: n,
  attenuation: n,
  unfermentable: z.boolean().nullish().transform((v) => v ?? false),
});

export const recipeData = z.object({
  name: z.string().trim().min(1),
  style: s,
  notes: s,
  versionNotes: s,
  batchSize: z.number().positive(),
  boilTime: z.number().int().min(0).nullish().transform((v) => v ?? 60),
  targetOg: n,
  targetFg: n,
  targetIbu: n,
  targetSrm: n,
  targetCarbonation: n,
  waterSource: s,
  mashWaterL: n,
  spargeWaterL: n,
  targetMashPh: n,
  equipment: s,
  ingredients: z.array(fileIngredient),
  mashSteps: z.array(z.object({ name: z.string().min(1), temperature: z.number(), timeMin: z.number().int() })),
  fermentationSteps: z
    .array(z.object({ name: z.string().min(1), temperature: n, days: n, notes: s }))
    .nullish()
    .transform((v) => v ?? []),
});

export type RecipeData = z.infer<typeof recipeData>;
export type RecipeDataIngredient = RecipeData["ingredients"][number];

export const recipeFile = z.object({
  format: z.literal(RECIPE_FILE_FORMAT),
  schemaVersion: z.literal(1),
  exportedAt: z.string().optional(),
  recipe: recipeData,
});
export type RecipeFile = z.infer<typeof recipeFile>;

type VersionWithChildren = {
  version: number;
  notes: string | null;
  batchSize: number;
  boilTime: number;
  targetOg: number | null;
  targetFg: number | null;
  targetIbu: number | null;
  targetSrm: number | null;
  targetCarbonation: number | null;
  waterSource: string | null;
  mashWaterL: number | null;
  spargeWaterL: number | null;
  targetMashPh: number | null;
  equipmentProfile: { name: string } | null;
  ingredients: {
    nameSnapshot: string;
    brandSnapshot: string | null;
    alphaAcidSnapshot: number | null;
    colorSnapshot: number | null;
    attenuationSnapshot: number | null;
    amount: number;
    unit: string;
    stage: z.infer<typeof additionStage>;
    additionTime: number | null;
    notes: string | null;
    ingredient: {
      type: z.infer<typeof ingredientType>;
      potential: number | null;
      alphaAcid: number | null;
      color: number | null;
      attenuation: number | null;
      unfermentable: boolean;
    };
  }[];
  mashSteps: { name: string; temperature: number; timeMin: number }[];
  fermentationSteps: { name: string; temperature: number | null; days: number | null; notes: string | null }[];
};

/** A recipe version as plain data. */
export function toRecipeData(recipe: { name: string; style: string | null; notes: string | null }, v: VersionWithChildren): RecipeData {
  return {
    name: recipe.name,
    style: recipe.style,
    notes: recipe.notes,
    versionNotes: v.notes,
    batchSize: v.batchSize,
    boilTime: v.boilTime,
    targetOg: v.targetOg,
    targetFg: v.targetFg,
    targetIbu: v.targetIbu,
    targetSrm: v.targetSrm,
    targetCarbonation: v.targetCarbonation,
    waterSource: v.waterSource,
    mashWaterL: v.mashWaterL,
    spargeWaterL: v.spargeWaterL,
    targetMashPh: v.targetMashPh,
    equipment: v.equipmentProfile?.name ?? null,
    ingredients: v.ingredients.map((i) => ({
      name: i.nameSnapshot,
      type: i.ingredient.type,
      brand: i.brandSnapshot,
      amount: i.amount,
      unit: i.unit,
      stage: i.stage,
      additionTime: i.additionTime,
      notes: i.notes,
      alphaAcid: i.alphaAcidSnapshot ?? i.ingredient.alphaAcid,
      color: i.colorSnapshot ?? i.ingredient.color,
      potential: i.ingredient.potential,
      attenuation: i.attenuationSnapshot ?? i.ingredient.attenuation,
      unfermentable: i.ingredient.unfermentable,
    })),
    mashSteps: v.mashSteps.map(({ name, temperature, timeMin }) => ({ name, temperature, timeMin })),
    fermentationSteps: v.fermentationSteps.map(({ name, temperature, days, notes }) => ({ name, temperature, days, notes })),
  };
}

/** Same recipe at another batch size: amounts scale and round; gravities, IBU and timings stay. */
export function scaleRecipeData(
  data: RecipeData,
  size: number,
  equipment: { boilOffRate: number; trubLoss: number; mashTunDeadspace: number } | null,
): RecipeData {
  if (size === data.batchSize) return data;
  const ratio = size / data.batchSize;
  return {
    ...data,
    batchSize: size,
    ...scaleWater({ mashWaterL: data.mashWaterL, spargeWaterL: data.spargeWaterL, boilTime: data.boilTime }, equipment, ratio),
    ingredients: data.ingredients.map((i) => ({ ...i, amount: roundAmount(i.amount * ratio, i.unit) })),
  };
}

export function toRecipeFile(data: RecipeData, exportedAt = new Date()): RecipeFile {
  return { format: RECIPE_FILE_FORMAT, schemaVersion: 1, exportedAt: exportedAt.toISOString(), recipe: data };
}

/** Parses a recipe file's JSON; throws with a readable message if it isn't one. */
export function parseRecipeFile(json: unknown): RecipeFile {
  if (typeof json !== "object" || json == null || (json as { format?: unknown }).format !== RECIPE_FILE_FORMAT) {
    throw new Error("This isn't a Brewing Journal recipe file");
  }
  const result = recipeFile.safeParse(json);
  if (!result.success) throw new Error("This recipe file is damaged or from a newer version of the app");
  return result.data;
}

// ---- Recipe code: the same data, compressed into one line of text for printed sheets and QR codes ----

export const CODE_START = "BJR1:";
export const CODE_END = ":BJR";

/** Drops nulls, empty strings, empty lists and default values to keep the code short. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => v != null && v !== "" && !(k === "unfermentable" && v === false))
        .map(([k, v]) => [k, compact(v)]),
    );
  }
  return value;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Just the payload (no markers), as used in the QR link. */
export async function encodeRecipePayload(data: RecipeData) {
  const json = JSON.stringify(compact(data));
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw")));
}

export async function decodeRecipePayload(payload: string): Promise<RecipeData> {
  const bytes = await pipe(fromBase64Url(payload.replace(/[^A-Za-z0-9_-]/g, "")), new DecompressionStream("deflate-raw"));
  const result = recipeData.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  if (!result.success) throw new Error("This recipe code is damaged");
  return result.data;
}

export async function encodeRecipeCode(data: RecipeData) {
  return `${CODE_START}${await encodeRecipePayload(data)}${CODE_END}`;
}

/**
 * Finds a recipe code anywhere in some text (e.g. extracted from a PDF, where the line may be
 * wrapped or split by spaces) and decodes it. Returns null when there is none or it's damaged.
 */
export async function findRecipeCode(text: string): Promise<RecipeData | null> {
  const start = text.indexOf(CODE_START);
  if (start < 0) return null;
  const end = text.indexOf(CODE_END, start + CODE_START.length);
  if (end < 0) return null;
  try {
    return await decodeRecipePayload(text.slice(start + CODE_START.length, end).replace(/\s+/g, ""));
  } catch {
    return null;
  }
}
