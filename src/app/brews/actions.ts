"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { run } from "@/lib/action";
import { PACKAGING_METHODS, STATUSES, STEPS, validateGravity } from "@/lib/brewing";
import { int, num, required, str, type ActionState } from "@/lib/form";
import { PHOTO_MAX_BYTES, sniffImageType } from "@/lib/image";
import type { BrewStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const touch = () => revalidatePath("/", "layout");

const allSteps = () => ({ create: STEPS.map((s) => ({ type: s.type })) });

async function nextBatchNumber(tx: Prisma.TransactionClient, recipeId: number) {
  const last = await tx.brewSession.aggregate({ where: { recipeId }, _max: { batchNumber: true } });
  return (last._max.batchNumber ?? 0) + 1;
}

/** "Brew Again": new session from a recipe version. Copies the plan, never the actuals. */
export async function startBrew(recipeVersionId: number, _: ActionState) {
  return run(async () => {
    const version = await db.recipeVersion.findUniqueOrThrow({
      where: { id: recipeVersionId },
      include: { ingredients: { orderBy: { sortOrder: "asc" } } },
    });
    const session = await db.$transaction(async (tx) =>
      tx.brewSession.create({
        data: {
          recipeId: version.recipeId,
          recipeVersionId: version.id,
          batchNumber: await nextBatchNumber(tx, version.recipeId),
          brewDate: new Date(),
          ingredients: {
            create: version.ingredients.map((i) => ({
              ingredientId: i.ingredientId,
              nameSnapshot: i.nameSnapshot,
              plannedAmount: i.amount,
              unit: i.unit,
              stage: i.stage,
              additionTime: i.additionTime,
              notes: i.notes,
              sortOrder: i.sortOrder,
            })),
          },
          steps: allSteps(),
        },
      }),
    );
    revalidatePath("/", "layout");
    redirect(`/brews/${session.id}`);
  });
}

/** "Clone This Brew": plan comes from what actually went into the source batch. */
export async function cloneBrew(sourceId: number, _: ActionState) {
  return run(async () => {
    const source = await db.brewSession.findUniqueOrThrow({
      where: { id: sourceId },
      include: { ingredients: { orderBy: { sortOrder: "asc" } } },
    });
    const session = await db.$transaction(async (tx) =>
      tx.brewSession.create({
        data: {
          recipeId: source.recipeId,
          recipeVersionId: source.recipeVersionId,
          clonedFromSessionId: source.id,
          batchNumber: await nextBatchNumber(tx, source.recipeId),
          brewDate: new Date(),
          packagingMethod: source.packagingMethod,
          ingredients: {
            create: source.ingredients.map((i) => ({
              ingredientId: i.ingredientId,
              nameSnapshot: i.nameSnapshot,
              plannedAmount: i.actualAmount ?? i.plannedAmount,
              unit: i.unit,
              stage: i.stage,
              additionTime: i.additionTime,
              sortOrder: i.sortOrder,
            })),
          },
          steps: allSteps(),
        },
      }),
    );
    revalidatePath("/", "layout");
    redirect(`/brews/${session.id}`);
  });
}

export async function updateSession(id: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const actualOg = num(fd, "actualOg");
    const actualFg = num(fd, "actualFg");
    const gravityError = validateGravity(actualOg, actualFg);
    if (gravityError) throw new Error(gravityError);
    const status = str(fd, "status") as BrewStatus | null;
    if (!status || !STATUSES.some((x) => x.value === status)) throw new Error("Pick a status");
    const brewDate = required(str(fd, "brewDate"), "Brew date");
    await db.brewSession.update({
      where: { id },
      data: {
        status,
        brewDate: new Date(`${brewDate}T12:00:00`),
        actualVolume: num(fd, "actualVolume"),
        actualOg,
        actualFg,
        notes: str(fd, "notes"),
      },
    });
    touch();
  });
}

export async function deleteSession(id: number, _: ActionState) {
  return run(async () => {
    await db.brewSession.delete({ where: { id } });
    touch();
    redirect("/brews");
  });
}

export async function updateBrewIngredient(id: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const row = await db.brewIngredient.findUniqueOrThrow({ where: { id } });
    const swapTo = num(fd, "swapTo");
    let swap = {};
    if (swapTo != null && swapTo !== row.ingredientId) {
      const ing = await db.ingredient.findUniqueOrThrow({ where: { id: swapTo } });
      swap = {
        ingredientId: ing.id,
        nameSnapshot: ing.name,
        substitutedForName: row.substitutedForName ?? row.nameSnapshot,
      };
    }
    await db.brewIngredient.update({
      where: { id },
      data: { actualAmount: num(fd, "actualAmount"), notes: str(fd, "notes"), ...swap },
    });
    touch();
  });
}

/** Upserts one measurement per preset label; clearing a field removes that reading. */
export async function saveStepActuals(stepId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const step = await db.brewStep.findUniqueOrThrow({ where: { id: stepId } });
    const presets = STEPS.find((s) => s.type === step.type)!.presets;
    const existing = await db.measurement.findMany({
      where: { brewStepId: stepId, type: { in: presets.map((p) => p.type) } },
    });
    await db.$transaction(async (tx) => {
      for (const [idx, preset] of presets.entries()) {
        const value = num(fd, `preset-${idx}`);
        const current = existing.find((m) => m.type === preset.type);
        if (value == null) {
          if (current) await tx.measurement.delete({ where: { id: current.id } });
        } else if (current) {
          if (current.value !== value) await tx.measurement.update({ where: { id: current.id }, data: { value } });
        } else {
          await tx.measurement.create({
            data: { brewStepId: stepId, type: preset.type, value, unit: preset.unit ?? null },
          });
        }
      }
      if (step.type === "PACKAGING") {
        const method = str(fd, "packagingMethod");
        if (method && !PACKAGING_METHODS.includes(method)) throw new Error("Unknown packaging method");
        await tx.brewSession.update({ where: { id: step.brewSessionId }, data: { packagingMethod: method } });
      }
    });
    touch();
  });
}

export async function addMeasurement(stepId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    await db.measurement.create({
      data: {
        brewStepId: stepId,
        type: required(str(fd, "type"), "Measurement name"),
        value: required(num(fd, "value"), "Value"),
        unit: str(fd, "unit"),
        notes: str(fd, "notes"),
      },
    });
    touch();
  });
}

export async function deleteMeasurement(id: number) {
  await db.measurement.delete({ where: { id } });
  touch();
}

export async function saveStepNotes(stepId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    await db.brewStep.update({ where: { id: stepId }, data: { notes: str(fd, "notes") } });
    touch();
  });
}

export async function setStepComplete(stepId: number, complete: boolean) {
  await db.brewStep.update({ where: { id: stepId }, data: { completedAt: complete ? new Date() : null } });
  touch();
}

export async function addFermentationLog(stepId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const gravity = num(fd, "gravity");
    const gravityError = validateGravity(gravity, null);
    if (gravityError) throw new Error(gravityError.replace("OG", "Gravity"));
    await db.fermentationLog.create({
      data: {
        brewStepId: stepId,
        date: new Date(`${required(str(fd, "date"), "Date")}T12:00:00`),
        temperature: num(fd, "temperature"),
        gravity,
        ph: num(fd, "ph"),
        activity: str(fd, "activity"),
        notes: str(fd, "notes"),
      },
    });
    touch();
  });
}

export async function deleteFermentationLog(id: number) {
  await db.fermentationLog.delete({ where: { id } });
  touch();
}

export async function addProblem(sessionId: number, stepId: number | null, _: ActionState, fd: FormData) {
  return run(async () => {
    const lesson = str(fd, "lesson");
    await db.problem.create({
      data: {
        brewSessionId: sessionId,
        brewStepId: stepId,
        title: required(str(fd, "title"), "Problem"),
        description: str(fd, "description"),
        cause: str(fd, "cause"),
        action: str(fd, "action"),
        impact: str(fd, "impact"),
        ...(lesson && { lessons: { create: { text: lesson, brewSessionId: sessionId, tags: [] } } }),
      },
    });
    touch();
  });
}

export async function deleteProblem(id: number) {
  await db.problem.delete({ where: { id } });
  touch();
}

export async function addLesson(sessionId: number | null, _: ActionState, fd: FormData) {
  return run(async () => {
    const tags = (str(fd, "tags") ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const problemId = num(fd, "problemId");
    await db.lesson.create({
      data: {
        text: required(str(fd, "text"), "Lesson"),
        tags,
        brewSessionId: sessionId,
        problemId,
      },
    });
    touch();
  });
}

export async function deleteLesson(id: number) {
  await db.lesson.delete({ where: { id } });
  touch();
}

export async function uploadPhoto(stepId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    const file = fd.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a photo");
    if (file.size > PHOTO_MAX_BYTES) throw new Error("Photo is too large (max 3.5 MB after resizing)");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffImageType(bytes);
    if (!mimeType) throw new Error("Only JPEG, PNG or WebP photos are supported");
    const count = await db.photo.count({ where: { brewStepId: stepId } });
    if (count >= 24) throw new Error("This step already has 24 photos");
    await db.photo.create({
      data: {
        brewStepId: stepId,
        mimeType,
        data: bytes,
        width: int(fd, "width"),
        height: int(fd, "height"),
        caption: str(fd, "caption"),
      },
    });
    touch();
  });
}

export async function deletePhoto(id: number) {
  await db.photo.delete({ where: { id } });
  touch();
}
