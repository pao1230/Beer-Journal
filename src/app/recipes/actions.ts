"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { run } from "@/lib/action";
import { UserError } from "@/lib/user-error";
import { int, num, required, str, type ActionState } from "@/lib/form";
import { DEFAULT_UNIT, roundAmount, scaleWater, UNITS, validateGravity } from "@/lib/brewing";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

const stage = z.enum(["MASH", "SPARGE", "BOIL", "WHIRLPOOL", "FERMENTATION", "DRY_HOP", "PACKAGING"]);

const ingredientType = z.enum(["GRAIN", "HOP", "YEAST", "WATER", "OTHER"]);

const ingredientRows = z.array(
  z.object({
    ingredientId: z.number().int().nullable(),
    newIngredient: z
      .object({
        name: z.string().trim().min(1, "New ingredients need a name").max(100),
        type: ingredientType,
        // From an imported recipe file, so calculations work straight away.
        specs: z
          .object({
            brand: z.string().max(100).nullable(),
            alphaAcid: z.number().min(0).max(100).nullable(),
            color: z.number().min(0).max(1000).nullable(),
            potential: z.number().min(1).max(1.1).nullable(),
            attenuation: z.number().min(0).max(100).nullable(),
            unfermentable: z.boolean(),
          })
          .partial()
          .nullish(),
      })
      .nullable()
      .optional(),
    amount: z.number().positive("Ingredient amounts must be greater than 0"),
    unit: z.string().min(1),
    stage,
    additionTime: z.number().int().nullable(),
    notes: z.string().nullable(),
  }).refine((r) => r.ingredientId != null || r.newIngredient, "Each ingredient line needs an ingredient"),
);

const mashRows = z.array(
  z.object({
    name: z.string().min(1, "Each mash step needs a name"),
    temperature: z.number().min(0).max(100),
    timeMin: z.number().int().min(0),
  }),
);

const fermentRows = z.array(
  z.object({
    name: z.string().min(1, "Each fermentation step needs a name"),
    temperature: z.number().min(-5).max(100).nullable(),
    days: z.number().min(0).max(365).nullable(),
    notes: z.string().nullable(),
  }),
);

/** Stock the brewer already has of an ingredient created with this recipe ("I have it"). */
const newStockRows = z.array(
  z.object({ name: z.string().trim().min(1), type: ingredientType, amount: z.number().min(0) }),
);

function parseJson<T>(schema: z.ZodType<T>, raw: string | null): T {
  const result = schema.safeParse(JSON.parse(raw ?? "[]"));
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Invalid rows");
  return result.data;
}

function parseVersion(fd: FormData) {
  const targetOg = num(fd, "targetOg");
  const targetFg = num(fd, "targetFg");
  const gravityError = validateGravity(targetOg, targetFg, ["Target OG", "Target FG"]);
  if (gravityError) throw gravityError;
  return {
    notes: str(fd, "versionNotes"),
    equipmentProfileId: int(fd, "equipmentProfileId"),
    batchSize: required(num(fd, "batchSize"), "Batch size"),
    boilTime: int(fd, "boilTime") ?? 60,
    targetOg,
    targetFg,
    targetIbu: num(fd, "targetIbu"),
    targetSrm: num(fd, "targetSrm"),
    targetCarbonation: num(fd, "targetCarbonation"),
    waterSource: str(fd, "waterSource"),
    mashWaterL: num(fd, "mashWaterL"),
    spargeWaterL: num(fd, "spargeWaterL"),
    targetMashPh: num(fd, "targetMashPh"),
  };
}

/** Reuses an ingredient with the same name and type (any case), otherwise creates it. */
type NewSpecs = { brand?: string | null; alphaAcid?: number | null; color?: number | null; potential?: number | null; attenuation?: number | null; unfermentable?: boolean };

async function findOrCreateIngredient(tx: Tx, name: string, type: z.infer<typeof ingredientType>, specs?: NewSpecs | null) {
  const existing = await tx.ingredient.findFirst({
    where: { type, name: { equals: name, mode: "insensitive" } },
    orderBy: { isArchived: "asc" },
  });
  if (existing) {
    return existing.isArchived ? tx.ingredient.update({ where: { id: existing.id }, data: { isArchived: false } }) : existing;
  }
  return tx.ingredient.create({ data: { ...specs, name, type, stockUnit: DEFAULT_UNIT[type] } });
}

const ingredientKey = (name: string, type: string) => `${type}|${name.trim().toLowerCase()}`;

/** Records "I have it" amounts for newly created ingredients as a stock count. */
async function recordNewStock(tx: Tx, fd: FormData, created: Map<string, number>) {
  for (const s of parseJson(newStockRows, str(fd, "newStock"))) {
    const ingredientId = created.get(ingredientKey(s.name, s.type));
    if (ingredientId == null) continue;
    const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, select: { stockUnit: true } });
    if (!ing.stockUnit) continue;
    const { _sum } = await tx.inventoryTransaction.aggregate({ where: { ingredientId }, _sum: { amount: true } });
    const delta = s.amount - (_sum.amount ?? 0);
    if (Math.abs(delta) < 1e-9) continue;
    await tx.inventoryTransaction.create({ data: { ingredientId, amount: delta, reason: "ADJUSTMENT", note: "Stock count" } });
  }
}

/** Ingredient, mash and fermentation rows for a version; creates new ingredients typed into the editor. */
async function versionChildren(tx: Tx, fd: FormData) {
  const parsed = parseJson(ingredientRows, str(fd, "ingredients"));
  const mash = parseJson(mashRows, str(fd, "mashSteps"));
  const ferment = parseJson(fermentRows, str(fd, "fermentationSteps"));
  const created = new Map<string, number>();
  const rows = [];
  for (const r of parsed) {
    if (!UNITS.includes(r.unit)) throw new UserError("Unknown unit “{unit}”", { unit: r.unit });
    let ingredientId = r.ingredientId;
    if (ingredientId == null && r.newIngredient) {
      const key = ingredientKey(r.newIngredient.name, r.newIngredient.type);
      ingredientId = created.get(key) ?? (await findOrCreateIngredient(tx, r.newIngredient.name, r.newIngredient.type, r.newIngredient.specs)).id;
      created.set(key, ingredientId);
    }
    rows.push({ ...r, ingredientId: ingredientId! });
  }
  const ingredients = await tx.ingredient.findMany({
    where: { id: { in: rows.map((r) => r.ingredientId) } },
  });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const ingredientData: Prisma.RecipeIngredientCreateWithoutRecipeVersionInput[] = rows.map((r, idx) => {
    const ing = byId.get(r.ingredientId);
    if (!ing) throw new Error("An ingredient in this recipe no longer exists");
    return {
      ingredient: { connect: { id: ing.id } },
      nameSnapshot: ing.name,
      brandSnapshot: ing.brand,
      alphaAcidSnapshot: ing.alphaAcid,
      colorSnapshot: ing.color,
      attenuationSnapshot: ing.attenuation,
      amount: r.amount,
      unit: r.unit,
      stage: r.stage,
      additionTime: r.additionTime,
      notes: r.notes,
      sortOrder: idx,
    };
  });
  const mashData = mash.map((m, idx) => ({ ...m, stepOrder: idx }));
  const fermentData = ferment.map((f, idx) => ({ ...f, stepOrder: idx }));
  await recordNewStock(tx, fd, created);
  return { ingredientData, mashData, fermentData };
}

export async function createRecipe(_: ActionState, fd: FormData) {
  return run(async () => {
    const version = parseVersion(fd);
    const name = required(str(fd, "name"), "Recipe name");
    // One transaction: a failed save leaves no half-created ingredients or stock behind.
    const recipe = await db.$transaction(async (tx) => {
      const { ingredientData, mashData, fermentData } = await versionChildren(tx, fd);
      return tx.recipe.create({
        data: {
          name,
          style: str(fd, "style"),
          notes: str(fd, "notes"),
          versions: {
            create: {
              version: 1,
              ...version,
              ingredients: { create: ingredientData },
              mashSteps: { create: mashData },
              fermentationSteps: { create: fermentData },
            },
          },
        },
      });
    });
    revalidatePath("/recipes");
    redirect(`/recipes/${recipe.id}`);
  });
}

/**
 * Edits the latest version in place while it has never been brewed; once a brew
 * references it (or the user asks), saves a new version so old brews keep their targets.
 */
export async function updateRecipe(recipeId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const version = parseVersion(fd);
    const name = required(str(fd, "name"), "Recipe name");
    const latest = await db.recipeVersion.findFirstOrThrow({
      where: { recipeId },
      orderBy: { version: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    const newVersion = latest._count.sessions > 0 || fd.get("asNewVersion") === "on";

    await db.$transaction(async (tx) => {
      const { ingredientData, mashData, fermentData } = await versionChildren(tx, fd);
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          name,
          style: str(fd, "style"),
          notes: str(fd, "notes"),
        },
      });
      if (newVersion) {
        await tx.recipeVersion.create({
          data: {
            recipeId,
            version: latest.version + 1,
            ...version,
            ingredients: { create: ingredientData },
            mashSteps: { create: mashData },
            fermentationSteps: { create: fermentData },
          },
        });
      } else {
        await tx.recipeIngredient.deleteMany({ where: { recipeVersionId: latest.id } });
        await tx.mashStep.deleteMany({ where: { recipeVersionId: latest.id } });
        await tx.fermentationStep.deleteMany({ where: { recipeVersionId: latest.id } });
        await tx.recipeVersion.update({
          where: { id: latest.id },
          data: {
            ...version,
            ingredients: { create: ingredientData },
            mashSteps: { create: mashData },
            fermentationSteps: { create: fermentData },
          },
        });
      }
    });
    revalidatePath("/recipes");
    redirect(`/recipes/${recipeId}`);
  });
}

export async function deleteRecipe(recipeId: number, _: ActionState) {
  return run(async () => {
    const brews = await db.brewSession.count({ where: { recipeId } });
    if (brews > 0) throw new UserError("This recipe has {n} brew(s) — delete those first.", { n: brews });
    await db.recipe.delete({ where: { id: recipeId } });
    revalidatePath("/recipes");
    redirect("/recipes");
  });
}

/** Saves a version scaled to a new batch size, as a new version or as a separate recipe. */
export async function saveScaledRecipe(versionId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const size = required(num(fd, "size"), "Batch size");
    if (size <= 0 || size > 2000) throw new Error("Batch size must be between 0 and 2000 L");
    const mode = str(fd, "mode");
    if (mode !== "version" && mode !== "copy") throw new Error("Choose how to save");

    const src = await db.recipeVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        recipe: true,
        equipmentProfile: true,
        ingredients: { orderBy: { sortOrder: "asc" } },
        mashSteps: true,
        fermentationSteps: true,
      },
    });
    const ratio = size / src.batchSize;
    const water = scaleWater(src, src.equipmentProfile, ratio);
    const data = {
      notes: `Scaled from ${src.batchSize} L (v${src.version}) to ${size} L`,
      equipmentProfileId: src.equipmentProfileId,
      batchSize: size,
      boilTime: src.boilTime,
      targetOg: src.targetOg,
      targetFg: src.targetFg,
      targetIbu: src.targetIbu,
      targetSrm: src.targetSrm,
      targetCarbonation: src.targetCarbonation,
      waterSource: src.waterSource,
      targetMashPh: src.targetMashPh,
      ...water,
      ingredients: {
        create: src.ingredients.map(({ id: _id, recipeVersionId: _v, amount, ...rest }) => ({
          ...rest,
          amount: roundAmount(amount * ratio, rest.unit),
        })),
      },
      mashSteps: {
        create: src.mashSteps.map(({ stepOrder, name, temperature, timeMin }) => ({ stepOrder, name, temperature, timeMin })),
      },
      fermentationSteps: {
        create: src.fermentationSteps.map(({ stepOrder, name, temperature, days, notes }) => ({ stepOrder, name, temperature, days, notes })),
      },
    };

    let recipeId = src.recipeId;
    if (mode === "version") {
      const latest = await db.recipeVersion.aggregate({ where: { recipeId }, _max: { version: true } });
      await db.recipeVersion.create({ data: { recipeId, version: (latest._max.version ?? 0) + 1, ...data } });
    } else {
      const copy = await db.recipe.create({
        data: {
          name: `${src.recipe.name} (${size} L)`,
          style: src.recipe.style,
          notes: src.recipe.notes,
          versions: { create: { version: 1, ...data } },
        },
      });
      recipeId = copy.id;
    }
    revalidatePath("/recipes");
    redirect(`/recipes/${recipeId}`);
  });
}

/** Saves an imported recipe: as a new recipe, or as a new version of `importTarget`. */
export async function importRecipe(prev: ActionState, fd: FormData) {
  const target = int(fd, "importTarget");
  if (target == null) return createRecipe(prev, fd);
  fd.set("asNewVersion", "on");
  return updateRecipe(target, prev, fd);
}
