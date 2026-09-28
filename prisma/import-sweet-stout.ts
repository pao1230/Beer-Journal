import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { appDatabaseUrl } from "../src/lib/db-url";
import { RECIPE_NAME, addSweetStout } from "./sweet-stout";

/**
 * Adds the Sweet Stout recipe and brew #001 to a database that already has data (the seed only
 * runs on an empty one). Safe to re-run: it does nothing if a "Sweet Stout" recipe exists.
 *   DATABASE_URL="postgresql://…" npm run db:import-sweet-stout
 */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: appDatabaseUrl() }) });

async function main() {
  const equipment = await db.equipmentProfile.findFirst({ where: { name: "Home 3-Vessel" } });
  const result = await db.$transaction((tx) => addSweetStout(tx, equipment?.id ?? null), { timeout: 60_000 });
  if (!result) {
    console.log(`A recipe named "${RECIPE_NAME}" already exists — nothing added.`);
    return;
  }
  console.log(`Added "${RECIPE_NAME}" (recipe #${result.recipeId}) and brew #001, and deducted its ingredients from stock.`);
  console.log(
    result.createdIngredients.length > 0
      ? `New ingredients (not in your list before): ${result.createdIngredients.join(", ")}`
      : "All ingredients were already in your list.",
  );
  if (!equipment) console.log("No equipment profile named \"Home 3-Vessel\", so the recipe has none — pick one in the recipe editor.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
