"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { run } from "@/lib/action";
import { num, required, str, type ActionState } from "@/lib/form";
import { INGREDIENT_TYPES } from "@/lib/brewing";
import type { IngredientType } from "@/generated/prisma/enums";

function parse(fd: FormData) {
  const type = str(fd, "type") as IngredientType | null;
  if (!type || !INGREDIENT_TYPES.some((t) => t.value === type)) throw new Error("Pick a type");
  const pick = <T,>(types: IngredientType[], v: T) => (types.includes(type) ? v : null);
  return {
    name: required(str(fd, "name"), "Name"),
    type,
    brand: str(fd, "brand"),
    supplier: str(fd, "supplier"),
    notes: str(fd, "notes"),
    color: pick(["GRAIN"], num(fd, "color")),
    potential: pick(["GRAIN"], num(fd, "potential")),
    alphaAcid: pick(["HOP"], num(fd, "alphaAcid")),
    form: pick(["HOP", "YEAST"], str(fd, "form")),
    attenuation: pick(["YEAST"], num(fd, "attenuation")),
    flocculation: pick(["YEAST"], str(fd, "flocculation")),
  };
}

export async function createIngredient(_: ActionState, fd: FormData) {
  return run(async () => {
    await db.ingredient.create({ data: parse(fd) });
    revalidatePath("/ingredients");
    redirect("/ingredients");
  });
}

export async function updateIngredient(id: number, _: ActionState, fd: FormData) {
  return run(async () => {
    await db.ingredient.update({ where: { id }, data: parse(fd) });
    revalidatePath("/ingredients");
    redirect("/ingredients");
  });
}

export async function setArchived(id: number, isArchived: boolean) {
  await db.ingredient.update({ where: { id }, data: { isArchived } });
  revalidatePath("/ingredients");
}

export async function deleteIngredient(id: number, _: ActionState) {
  return run(async () => {
    const used = await db.recipeIngredient.count({ where: { ingredientId: id } });
    if (used > 0) {
      throw new Error(`Used in ${used} recipe line(s) — archive it instead so history stays intact.`);
    }
    await db.ingredient.delete({ where: { id } });
    revalidatePath("/ingredients");
    redirect("/ingredients");
  });
}
