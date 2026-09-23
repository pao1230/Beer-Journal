"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { run } from "@/lib/action";
import { int, num, required, str, type ActionState } from "@/lib/form";
import { roundAmount, scaleWater, validateGravity } from "@/lib/brewing";
import type { Prisma } from "@/generated/prisma/client";

const stage = z.enum(["MASH", "SPARGE", "BOIL", "WHIRLPOOL", "FERMENTATION", "DRY_HOP", "PACKAGING"]);

const ingredientRows = z.array(
  z.object({
    ingredientId: z.number().int(),
    amount: z.number().positive("Ingredient amounts must be greater than 0"),
    unit: z.string().min(1),
    stage,
    additionTime: z.number().int().nullable(),
    notes: z.string().nullable(),
  }),
);

const mashRows = z.array(
  z.object({
    name: z.string().min(1, "Each mash step needs a name"),
    temperature: z.number().min(0).max(100),
    timeMin: z.number().int().min(0),
  }),
);

function parseJson<T>(schema: z.ZodType<T>, raw: string | null): T {
  const result = schema.safeParse(JSON.parse(raw ?? "[]"));
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Invalid rows");
  return result.data;
}

function parseVersion(fd: FormData) {
  const targetOg = num(fd, "targetOg");
  const targetFg = num(fd, "targetFg");
  const gravityError = validateGravity(targetOg, targetFg);
  if (gravityError) throw new Error(`Target ${gravityError}`);
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

async function versionChildren(fd: FormData) {
  const rows = parseJson(ingredientRows, str(fd, "ingredients"));
  const mash = parseJson(mashRows, str(fd, "mashSteps"));
  const ingredients = await db.ingredient.findMany({
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
  return { ingredientData, mashData };
}

export async function createRecipe(_: ActionState, fd: FormData) {
  return run(async () => {
    const version = parseVersion(fd);
    const { ingredientData, mashData } = await versionChildren(fd);
    const recipe = await db.recipe.create({
      data: {
        name: required(str(fd, "name"), "Recipe name"),
        style: str(fd, "style"),
        notes: str(fd, "notes"),
        versions: {
          create: {
            version: 1,
            ...version,
            ingredients: { create: ingredientData },
            mashSteps: { create: mashData },
          },
        },
      },
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
    const { ingredientData, mashData } = await versionChildren(fd);
    const latest = await db.recipeVersion.findFirstOrThrow({
      where: { recipeId },
      orderBy: { version: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    const newVersion = latest._count.sessions > 0 || fd.get("asNewVersion") === "on";

    await db.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          name: required(str(fd, "name"), "Recipe name"),
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
          },
        });
      } else {
        await tx.recipeIngredient.deleteMany({ where: { recipeVersionId: latest.id } });
        await tx.mashStep.deleteMany({ where: { recipeVersionId: latest.id } });
        await tx.recipeVersion.update({
          where: { id: latest.id },
          data: {
            ...version,
            ingredients: { create: ingredientData },
            mashSteps: { create: mashData },
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
    if (brews > 0) throw new Error(`This recipe has ${brews} brew(s) — delete those first.`);
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
      include: { recipe: true, equipmentProfile: true, ingredients: { orderBy: { sortOrder: "asc" } }, mashSteps: true },
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
