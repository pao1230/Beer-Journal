import type { AdditionStage, IngredientType, Prisma } from "../src/generated/prisma/client";
import { convertUnit } from "../src/lib/calc";
import { STOCK_UNIT } from "../src/lib/catalog";

/*
 * The Sweet Stout recipe and brew #001, as in the exported brew report of 19 Sept 2026.
 * Used by the seed and by `npm run db:import-sweet-stout` for a database that already has data.
 */

type Db = Prisma.TransactionClient;
type Specs = Partial<{
  brand: string;
  color: number;
  potential: number;
  alphaAcid: number;
  form: string;
  attenuation: number;
  flocculation: string;
  waterSalt: string;
  unfermentable: boolean;
}>;

export const RECIPE_NAME = "Sweet Stout";

const STEP_TYPES = ["WATER_PREP", "MASHING", "SPARGING", "BOILING", "COOLING", "FERMENTATION", "PACKAGING"] as const;

// name, type, specs used when the ingredient doesn't exist yet, amount, unit, stage, addition time
const LINES: [string, IngredientType, Specs, number, string, AdditionStage, number | null][] = [
  ["Pale Ale Malt", "GRAIN", { brand: "Simpsons", color: 3, potential: 1.038 }, 4.2, "kg", "MASH", null],
  ["Roasted Barley", "GRAIN", { color: 500, potential: 1.025 }, 500, "g", "MASH", null],
  ["Caradis Malt", "GRAIN", { color: 150, potential: 1.034 }, 450, "g", "MASH", null],
  ["Carafa Special II", "GRAIN", { brand: "Weyermann", color: 430, potential: 1.032 }, 250, "g", "MASH", null],
  ["Flaked Oats", "GRAIN", { color: 1, potential: 1.033 }, 500, "g", "MASH", null],
  ["Sodium Bicarbonate (NaHCO3)", "WATER", { waterSalt: "NaHCO3" }, 7, "g", "MASH", null],
  ["Calcium Chloride (CaCl2)", "WATER", { waterSalt: "CaCl2" }, 3, "g", "MASH", null],
  ["Calcium Carbonate (CaCO3)", "WATER", { waterSalt: "CaCO3" }, 3, "g", "MASH", null],
  ["Magnum", "HOP", { alphaAcid: 12.5, form: "Pellet" }, 28, "g", "BOIL", 60],
  ["East Kent Golding", "HOP", { alphaAcid: 5.5, form: "Pellet" }, 28, "g", "BOIL", 45],
  ["Yeast Nutrient", "OTHER", {}, 1, "tsp", "BOIL", 20],
  ["Lactose", "OTHER", { potential: 1.035, unfermentable: true }, 500, "g", "BOIL", 5],
  ["Safale US-05", "YEAST", { brand: "Fermentis", attenuation: 81, form: "Dry", flocculation: "Medium" }, 1, "pkg", "FERMENTATION", null],
];

export const SWEET_STOUT_INGREDIENTS = LINES.map(([name, type, specs]) => ({ name, type, specs }));

/** Finds an ingredient by name and type (ignoring case, preferring active ones), or creates it. */
export async function findOrCreateIngredient(db: Db, name: string, type: IngredientType, specs: Specs = {}) {
  const found = await db.ingredient.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, type },
    orderBy: [{ isArchived: "asc" }, { id: "asc" }],
  });
  if (found) return { ingredient: found, created: false };
  return { ingredient: await db.ingredient.create({ data: { name, type, stockUnit: STOCK_UNIT[type], ...specs } }), created: true };
}

/**
 * Adds the recipe (v1) and brew #001 with its readings, problems, lessons and fermentation log,
 * and deducts the brew's ingredients from stock. Missing ingredients are created; existing ones
 * with the same name are reused. Returns null when a recipe with this name already exists.
 */
export async function addSweetStout(db: Db, equipmentProfileId: number | null) {
  if (await db.recipe.findFirst({ where: { name: { equals: RECIPE_NAME, mode: "insensitive" } } })) return null;

  const createdIngredients: string[] = [];
  const lines = [];
  for (const [i, [name, type, specs, amount, unit, stage, additionTime]] of LINES.entries()) {
    const { ingredient, created } = await findOrCreateIngredient(db, name, type, specs);
    if (created) createdIngredients.push(ingredient.name);
    lines.push({
      ingredientId: ingredient.id,
      stockUnit: ingredient.stockUnit,
      nameSnapshot: ingredient.name,
      brandSnapshot: ingredient.brand,
      alphaAcidSnapshot: ingredient.alphaAcid,
      colorSnapshot: ingredient.color,
      attenuationSnapshot: ingredient.attenuation,
      amount,
      unit,
      stage,
      additionTime,
      sortOrder: i,
    });
  }

  const recipe = await db.recipe.create({
    data: {
      name: RECIPE_NAME,
      style: "Sweet Stout",
      versions: {
        create: {
          version: 1,
          equipmentProfileId,
          batchSize: 20,
          boilTime: 60,
          targetOg: 1.074,
          targetFg: 1.026,
          targetIbu: 40,
          targetSrm: 45,
          targetCarbonation: 2.2,
          waterSource: "RO",
          mashWaterL: 17.8,
          spargeWaterL: 7.2,
          targetMashPh: 5.6,
          ingredients: { create: lines.map(({ stockUnit: _, ...l }) => l) },
          mashSteps: {
            create: [
              { stepOrder: 0, name: "Saccharification", temperature: 69, timeMin: 60 },
              { stepOrder: 1, name: "Mash out", temperature: 75, timeMin: 15 },
            ],
          },
        },
      },
    },
    include: { versions: true },
  });

  const brewDate = new Date("2026-09-19T12:00:00");
  const session = await db.brewSession.create({
    data: {
      recipeId: recipe.id,
      recipeVersionId: recipe.versions[0].id,
      batchNumber: 1,
      brewDate,
      status: "COMPLETED",
      actualVolume: 21.5,
      actualOg: 1.072,
      actualFg: 1.026,
      packagingMethod: "Bottle-condition",
      ingredients: {
        create: lines.map((l) => ({
          ingredientId: l.ingredientId,
          nameSnapshot: l.nameSnapshot,
          plannedAmount: l.amount,
          unit: l.unit,
          stage: l.stage,
          additionTime: l.additionTime,
          sortOrder: l.sortOrder,
        })),
      },
      steps: {
        create: STEP_TYPES.map((type) => ({ type, completedAt: brewDate })),
      },
    },
    include: { steps: true },
  });
  const step = (type: (typeof STEP_TYPES)[number]) => session.steps.find((s) => s.type === type)!.id;

  await db.measurement.createMany({
    data: [
      { brewStepId: step("WATER_PREP"), type: "pH", value: 5.7 },
      { brewStepId: step("WATER_PREP"), type: "Water temp", value: 27, unit: "°C" },
      { brewStepId: step("MASHING"), type: "Mash temp", value: 70, unit: "°C" },
      { brewStepId: step("MASHING"), type: "Mash time", value: 60, unit: "min" },
      { brewStepId: step("MASHING"), type: "Mash out temp", value: 76, unit: "°C" },
      { brewStepId: step("MASHING"), type: "Post-mash pH", value: 5.5 },
      { brewStepId: step("BOILING"), type: "Post-boil SG", value: 1.072 },
      { brewStepId: step("COOLING"), type: "Pitch temp", value: 21, unit: "°C" },
    ],
  });
  await db.brewStep.update({
    where: { id: step("MASHING") },
    data: { notes: "รอบนี้คน mash น้อยไปช่วง 10 นาทีแรก ทำให้อุณหภูมิด้านบนกับด้านล่างต่างกัน" },
  });

  await db.problem.create({
    data: {
      brewSessionId: session.id,
      brewStepId: step("MASHING"),
      title: "Mash temperature higher than target",
      description: "Target 69°C, actual 70°C",
      cause: "Strike water too hot",
      action: "Added cold water",
      impact: "Mash temperature came back to 69.5°C",
      lessons: { create: { text: "Lower strike temperature by 1°C", brewSessionId: session.id, tags: ["mash", "temperature"] } },
    },
  });
  await db.problem.create({
    data: {
      brewSessionId: session.id,
      brewStepId: step("BOILING"),
      title: "Hydrometer unusable",
      cause: "Water appeared inside hydrometer",
      action: "Used refractometer",
      lessons: { create: { text: "Keep a backup hydrometer", brewSessionId: session.id, tags: ["hydrometer", "equipment"] } },
    },
  });
  await db.lesson.createMany({
    data: [
      { text: "Don't measure OG while wort is ~70°C", brewSessionId: session.id, tags: ["gravity"] },
      { text: "Check final volume before calculating OG", brewSessionId: session.id, tags: ["gravity", "volume"] },
    ],
  });

  const day = (n: number) => new Date(brewDate.getTime() + n * 86_400_000);
  await db.fermentationLog.createMany({
    data: [
      { brewStepId: step("FERMENTATION"), date: day(1), temperature: 18.2, gravity: 1.06, activity: "High", notes: "Lots of krausen" },
      { brewStepId: step("FERMENTATION"), date: day(2), temperature: 18.1, gravity: 1.045 },
      { brewStepId: step("FERMENTATION"), date: day(3), temperature: 18.4, gravity: 1.03 },
      { brewStepId: step("FERMENTATION"), date: day(5), temperature: 18.0, gravity: 1.026 },
      { brewStepId: step("FERMENTATION"), date: day(6), temperature: 18.0, gravity: 1.026 },
    ],
  });

  const deductions = lines.flatMap((l) => {
    const amount = l.stockUnit ? convertUnit(l.amount, l.unit, l.stockUnit) : null;
    return amount == null ? [] : [{ ingredientId: l.ingredientId, amount: -amount, reason: "BREW" as const, brewSessionId: session.id }];
  });
  await db.inventoryTransaction.createMany({ data: deductions });

  return { recipeId: recipe.id, sessionId: session.id, createdIngredients };
}
