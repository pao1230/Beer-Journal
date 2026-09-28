import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type IngredientType } from "../src/generated/prisma/client";
import { STOCK_UNIT, importCatalog } from "../src/lib/catalog";
import { SWEET_STOUT_INGREDIENTS, addSweetStout, findOrCreateIngredient } from "./sweet-stout";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  if ((await db.ingredient.count()) > 0) {
    console.log("Database already has data — skipping seed. To add just the Sweet Stout recipe, run npm run db:import-sweet-stout.");
    return;
  }

  const equipment = await db.equipmentProfile.create({
    data: { name: "Home 3-Vessel", batchSize: 20, boilOffRate: 2.5, mashTunDeadspace: 0.5, trubLoss: 1, efficiency: 72 },
  });

  const recipeIngredients = new Map<string, { id: number }>();
  for (const { name, type, specs } of SWEET_STOUT_INGREDIENTS) {
    recipeIngredients.set(name, (await findOrCreateIngredient(db, name, type, specs)).ingredient);
  }
  const ing = (name: string, type: IngredientType, extra: Partial<{ brand: string; alphaAcid: number; form: string; attenuation: number; flocculation: string }> = {}) =>
    db.ingredient.create({ data: { name, type, stockUnit: STOCK_UNIT[type], ...extra } });
  await ing("Citra", "HOP", { alphaAcid: 12, form: "Pellet" });
  await ing("Saflager W-34/70", "YEAST", { brand: "Fermentis", attenuation: 83, form: "Dry", flocculation: "High" });
  await ing("Safale S-04", "YEAST", { brand: "Fermentis", attenuation: 75, form: "Dry", flocculation: "High" });
  await ing("Irish Moss", "OTHER");

  // Purchases in THB so batch cost and stock checks have something to show.
  const buy = (name: string, amount: number, totalCost: number) => ({
    ingredientId: recipeIngredients.get(name)!.id,
    amount,
    totalCost,
    reason: "PURCHASE" as const,
    note: "Brew Shop A",
  });
  await db.inventoryTransaction.createMany({
    data: [
      buy("Pale Ale Malt", 25, 1750),
      buy("Roasted Barley", 1, 120),
      buy("Caradis Malt", 1, 130),
      buy("Carafa Special II", 1, 150),
      buy("Flaked Oats", 1, 90),
      buy("Magnum", 100, 350),
      buy("East Kent Golding", 100, 320),
      buy("Safale US-05", 3, 450),
      buy("Lactose", 1000, 150),
      buy("Sodium Bicarbonate (NaHCO3)", 500, 60),
      buy("Calcium Chloride (CaCl2)", 500, 80),
      buy("Calcium Carbonate (CaCO3)", 500, 60),
    ],
  });

  await addSweetStout(db, equipment.id);
  await db.lesson.create({ data: { text: "Check mash temperature after stirring", tags: ["mash"] } });

  const added = await importCatalog(db);
  console.log(`Seeded Sweet Stout recipe, brew #001, starter ingredients (+${added} from the WAS Homebrew catalog) and inventory.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
