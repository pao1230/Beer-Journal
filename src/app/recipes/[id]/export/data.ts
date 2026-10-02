import "server-only";
import { db } from "@/lib/db";
import { scaleRecipeData, toRecipeData } from "@/lib/recipe-file";

/** A recipe version (latest unless `v` is given) as plain recipe data, scaled to `size` if given. */
export async function loadExportData(recipeId: number, v: number | null, size: number | null) {
  if (!Number.isInteger(recipeId)) return null;
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    include: { versions: { orderBy: { version: "desc" }, select: { version: true } } },
  });
  if (!recipe || recipe.versions.length === 0) return null;
  const versionNo = recipe.versions.some((x) => x.version === v) ? v! : recipe.versions[0].version;
  const version = await db.recipeVersion.findUniqueOrThrow({
    where: { recipeId_version: { recipeId, version: versionNo } },
    include: {
      equipmentProfile: true,
      ingredients: {
        orderBy: { sortOrder: "asc" },
        include: {
          ingredient: {
            select: { id: true, type: true, potential: true, alphaAcid: true, color: true, attenuation: true, unfermentable: true, waterSalt: true },
          },
        },
      },
      mashSteps: { orderBy: { stepOrder: "asc" } },
      fermentationSteps: { orderBy: { stepOrder: "asc" } },
    },
  });
  const original = toRecipeData(recipe, version);
  const data = size ? scaleRecipeData(original, size, version.equipmentProfile) : original;
  return {
    recipe,
    version,
    versions: recipe.versions.map((x) => x.version),
    data,
    scaledFrom: size && size !== original.batchSize ? original.batchSize : null,
    // Lines in the same order as data.ingredients, for stock checks and water salts.
    ingredientIds: version.ingredients.map((i) => i.ingredient.id),
    waterSalts: version.ingredients.map((i) => i.ingredient.waterSalt),
  };
}

/** "citra-simcoe-ipa-v3-20L" — ASCII only, for download file names. */
export function fileSlug(name: string, version: number, batchSize: number) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  return `${base || "recipe"}-v${version}-${batchSize}L`;
}
