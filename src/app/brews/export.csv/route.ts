import { db } from "@/lib/db";
import { abv, attenuation, batchLabel, labelOf, STATUSES } from "@/lib/brewing";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  const brews = await db.brewSession.findMany({
    orderBy: [{ brewDate: "asc" }, { batchNumber: "asc" }],
    include: {
      recipe: { select: { name: true, style: true } },
      recipeVersion: { select: { version: true, batchSize: true, targetOg: true, targetFg: true } },
      _count: { select: { problems: true, lessons: true } },
    },
  });
  const round = (n: number | null, d: number) => (n == null ? null : Number(n.toFixed(d)));
  const body = toCsv(
    ["Brew", "Recipe", "Style", "Version", "Batch", "Brew date", "Status", "Target volume L", "Volume L", "Target OG", "Target FG", "OG", "FG", "ABV %", "Attenuation %", "Packaging", "Problems", "Lessons", "Notes"],
    brews.map((b) => [
      batchLabel(b.recipe.name, b.batchNumber),
      b.recipe.name,
      b.recipe.style,
      b.recipeVersion.version,
      b.batchNumber,
      b.brewDate.toISOString().slice(0, 10),
      labelOf(STATUSES, b.status),
      b.recipeVersion.batchSize,
      b.actualVolume,
      b.recipeVersion.targetOg,
      b.recipeVersion.targetFg,
      b.actualOg,
      b.actualFg,
      round(abv(b.actualOg, b.actualFg), 2),
      round(attenuation(b.actualOg, b.actualFg), 1),
      b.packagingMethod,
      b._count.problems,
      b._count.lessons,
      b.notes,
    ]),
  );
  return csvResponse(body, `brews-${new Date().toISOString().slice(0, 10)}.csv`);
}
