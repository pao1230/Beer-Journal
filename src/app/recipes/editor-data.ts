import "server-only";
import { db } from "@/lib/db";

export async function editorOptions(extraIngredientIds: number[] = []) {
  const [ingredients, equipment] = await Promise.all([
    db.ingredient.findMany({
      where: { OR: [{ isArchived: false }, { id: { in: extraIngredientIds } }] },
      select: { id: true, name: true, type: true, brand: true, isArchived: true },
      orderBy: { name: "asc" },
    }),
    db.equipmentProfile.findMany({
      select: { id: true, name: true, batchSize: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { ingredients, equipment };
}
