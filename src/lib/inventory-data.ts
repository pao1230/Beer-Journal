import "server-only";
import { db } from "@/lib/db";
import { summarize } from "@/lib/inventory";

/** Stock on hand and weighted-average purchase cost per ingredient. */
export async function loadStock(ingredientIds?: number[]) {
  const where = ingredientIds ? { ingredientId: { in: ingredientIds } } : {};
  const [rows, ingredients] = await Promise.all([
    db.inventoryTransaction.findMany({ where, select: { ingredientId: true, amount: true, totalCost: true, reason: true } }),
    db.ingredient.findMany({
      where: ingredientIds ? { id: { in: ingredientIds } } : { stockUnit: { not: null } },
      select: { id: true, stockUnit: true },
    }),
  ]);
  return summarize(rows, new Map(ingredients.map((i) => [i.id, i.stockUnit])));
}
