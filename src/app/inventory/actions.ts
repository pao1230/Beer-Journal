"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { run } from "@/lib/action";
import { convertUnit } from "@/lib/calc";
import { num, required, str, type ActionState } from "@/lib/form";

const touch = () => revalidatePath("/", "layout");

async function trackedUnit(ingredientId: number) {
  const ing = await db.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, select: { stockUnit: true } });
  if (!ing.stockUnit) throw new Error("Set an inventory unit for this ingredient first");
  return ing.stockUnit;
}

export async function addPurchase(ingredientId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    await trackedUnit(ingredientId);
    const amount = required(num(fd, "amount"), "Amount");
    const totalCost = num(fd, "totalCost");
    if (amount <= 0) throw new Error("Amount must be greater than 0");
    if (totalCost != null && totalCost < 0) throw new Error("Price can't be negative");
    await db.inventoryTransaction.create({
      data: { ingredientId, amount, totalCost, reason: "PURCHASE", note: str(fd, "note") },
    });
    touch();
  });
}

/** Records a stock count: stores the difference from what the ledger says. */
export async function countStock(ingredientId: number, _: ActionState, fd: FormData) {
  return run(async () => {
    await trackedUnit(ingredientId);
    const counted = required(num(fd, "counted"), "Counted amount");
    if (counted < 0) throw new Error("Counted amount can't be negative");
    const { _sum } = await db.inventoryTransaction.aggregate({ where: { ingredientId }, _sum: { amount: true } });
    const delta = counted - (_sum.amount ?? 0);
    if (Math.abs(delta) < 1e-9) return;
    await db.inventoryTransaction.create({
      data: { ingredientId, amount: delta, reason: "ADJUSTMENT", note: str(fd, "note") ?? "Stock count" },
    });
    touch();
  });
}

export async function deleteTransaction(id: number) {
  await db.inventoryTransaction.delete({ where: { id } });
  touch();
}

/** Takes the brew's actual (or planned) amounts out of stock, once. */
export async function deductBrew(sessionId: number, _: ActionState) {
  return run(async () => {
    const already = await db.inventoryTransaction.count({ where: { brewSessionId: sessionId, reason: "BREW" } });
    if (already > 0) throw new Error("This brew has already been deducted from inventory");
    const lines = await db.brewIngredient.findMany({
      where: { brewSessionId: sessionId },
      include: { ingredient: { select: { id: true, stockUnit: true } } },
    });
    const data = lines.flatMap((l) => {
      const used = l.actualAmount ?? l.plannedAmount;
      if (!l.ingredient?.stockUnit || used == null) return [];
      const amount = convertUnit(used, l.unit, l.ingredient.stockUnit);
      if (amount == null || amount === 0) return [];
      return [{ ingredientId: l.ingredient.id, amount: -amount, reason: "BREW" as const, brewSessionId: sessionId }];
    });
    if (data.length === 0) throw new Error("None of this brew's ingredients have inventory tracking set up");
    await db.inventoryTransaction.createMany({ data });
    touch();
  });
}

export async function undoDeduction(sessionId: number, _: ActionState) {
  return run(async () => {
    await db.inventoryTransaction.deleteMany({ where: { brewSessionId: sessionId, reason: "BREW" } });
    touch();
  });
}
