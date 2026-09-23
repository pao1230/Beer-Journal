import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AdditionStage, type IngredientType } from "../src/generated/prisma/client";
import { convertUnit } from "../src/lib/calc";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const STOCK_UNIT: Record<IngredientType, string> = { GRAIN: "kg", HOP: "g", YEAST: "pkg", WATER: "g", OTHER: "g" };

const STEP_TYPES = ["WATER_PREP", "MASHING", "SPARGING", "BOILING", "COOLING", "FERMENTATION", "PACKAGING"] as const;

async function main() {
  if ((await db.ingredient.count()) > 0) {
    console.log("Database already has data — skipping seed.");
    return;
  }

  const equipment = await db.equipmentProfile.create({
    data: { name: "Home 3-Vessel", batchSize: 20, boilOffRate: 2.5, mashTunDeadspace: 0.5, trubLoss: 1, efficiency: 72 },
  });

  const ing = async (
    name: string,
    type: IngredientType,
    extra: Partial<{ brand: string; color: number; potential: number; alphaAcid: number; form: string; attenuation: number; flocculation: string; waterSalt: string; unfermentable: boolean }> = {},
  ) => db.ingredient.create({ data: { name, type, stockUnit: STOCK_UNIT[type], ...extra } });

  const paleAle = await ing("Pale Ale Malt", "GRAIN", { brand: "Simpsons", color: 3, potential: 1.038 });
  const roasted = await ing("Roasted Barley", "GRAIN", { color: 500, potential: 1.025 });
  const caradis = await ing("Caradis Malt", "GRAIN", { color: 150, potential: 1.034 });
  const carafa = await ing("Carafa Special II", "GRAIN", { brand: "Weyermann", color: 430, potential: 1.032 });
  const oats = await ing("Flaked Oats", "GRAIN", { color: 1, potential: 1.033 });
  const magnum = await ing("Magnum", "HOP", { alphaAcid: 12.5, form: "Pellet" });
  const ekg = await ing("East Kent Golding", "HOP", { alphaAcid: 5.5, form: "Pellet" });
  await ing("Citra", "HOP", { alphaAcid: 12, form: "Pellet" });
  const us05 = await ing("Safale US-05", "YEAST", { brand: "Fermentis", attenuation: 81, form: "Dry", flocculation: "Medium" });
  await ing("Saflager W-34/70", "YEAST", { brand: "Fermentis", attenuation: 83, form: "Dry", flocculation: "High" });
  await ing("Safale S-04", "YEAST", { brand: "Fermentis", attenuation: 75, form: "Dry", flocculation: "High" });
  const lactose = await ing("Lactose", "OTHER", { potential: 1.035, unfermentable: true });
  const nutrient = await ing("Yeast Nutrient", "OTHER");
  await ing("Irish Moss", "OTHER");
  const nahco3 = await ing("Sodium Bicarbonate (NaHCO3)", "WATER", { waterSalt: "NaHCO3" });
  const cacl2 = await ing("Calcium Chloride (CaCl2)", "WATER", { waterSalt: "CaCl2" });
  const caco3 = await ing("Calcium Carbonate (CaCO3)", "WATER", { waterSalt: "CaCO3" });

  // Purchases in THB so batch cost and stock checks have something to show.
  const buy = (i: { id: number }, amount: number, totalCost: number) => ({ ingredientId: i.id, amount, totalCost, reason: "PURCHASE" as const, note: "Brew Shop A" });
  await db.inventoryTransaction.createMany({
    data: [
      buy(paleAle, 25, 1750),
      buy(roasted, 1, 120),
      buy(caradis, 1, 130),
      buy(carafa, 1, 150),
      buy(oats, 1, 90),
      buy(magnum, 100, 350),
      buy(ekg, 100, 320),
      buy(us05, 3, 450),
      buy(lactose, 1000, 150),
      buy(nahco3, 500, 60),
      buy(cacl2, 500, 80),
      buy(caco3, 500, 60),
    ],
  });

  const line = (
    i: { id: number; name: string; brand: string | null; alphaAcid: number | null; color: number | null; attenuation: number | null },
    amount: number,
    unit: string,
    stage: AdditionStage,
    additionTime: number | null,
    sortOrder: number,
  ) => ({
    ingredientId: i.id,
    nameSnapshot: i.name,
    brandSnapshot: i.brand,
    alphaAcidSnapshot: i.alphaAcid,
    colorSnapshot: i.color,
    attenuationSnapshot: i.attenuation,
    amount,
    unit,
    stage,
    additionTime,
    sortOrder,
  });

  const stockUnitOf = new Map((await db.ingredient.findMany({ select: { id: true, stockUnit: true } })).map((i) => [i.id, i.stockUnit!]));
  const lines = [
    line(paleAle, 4.2, "kg", "MASH", null, 0),
    line(roasted, 500, "g", "MASH", null, 1),
    line(caradis, 450, "g", "MASH", null, 2),
    line(carafa, 250, "g", "MASH", null, 3),
    line(oats, 500, "g", "MASH", null, 4),
    line(nahco3, 7, "g", "MASH", null, 5),
    line(cacl2, 3, "g", "MASH", null, 6),
    line(caco3, 3, "g", "MASH", null, 7),
    line(magnum, 28, "g", "BOIL", 60, 8),
    line(ekg, 28, "g", "BOIL", 43, 9),
    line(nutrient, 1, "tsp", "BOIL", 20, 10),
    line(lactose, 500, "g", "BOIL", 5, 11),
    line(us05, 1, "pkg", "FERMENTATION", null, 12),
  ];

  const recipe = await db.recipe.create({
    data: {
      name: "Sweet Stout",
      style: "Sweet Stout",
      versions: {
        create: {
          version: 1,
          equipmentProfileId: equipment.id,
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
          ingredients: { create: lines },
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
      { text: "Check mash temperature after stirring", tags: ["mash"] },
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

  await db.inventoryTransaction.createMany({
    data: lines.flatMap((l) => {
      const amount = convertUnit(l.amount, l.unit, stockUnitOf.get(l.ingredientId)!);
      return amount == null ? [] : [{ ingredientId: l.ingredientId, amount: -amount, reason: "BREW" as const, brewSessionId: session.id }];
    }),
  });

  console.log("Seeded Sweet Stout recipe, brew #001, starter ingredients and inventory.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
