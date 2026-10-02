import "server-only";
import { db } from "@/lib/db";
import { loadStock } from "@/lib/inventory-data";

export async function editorOptions(extraIngredientIds: number[] = []) {
  const [ingredients, equipment, stockMap] = await Promise.all([
    db.ingredient.findMany({
      where: { OR: [{ isArchived: false }, { id: { in: extraIngredientIds } }] },
      select: {
        id: true,
        name: true,
        type: true,
        brand: true,
        isArchived: true,
        potential: true,
        waterSalt: true,
        alphaAcid: true,
        color: true,
        attenuation: true,
        unfermentable: true,
      },
      orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
    }),
    db.equipmentProfile.findMany({
      select: { id: true, name: true, batchSize: true, efficiency: true, trubLoss: true },
      orderBy: { name: "asc" },
    }),
    loadStock(),
  ]);
  const stock = Object.fromEntries([...stockMap].map(([id, s]) => [id, { stockUnit: s.stockUnit, onHand: s.onHand }]));
  return { ingredients, equipment, stock };
}
