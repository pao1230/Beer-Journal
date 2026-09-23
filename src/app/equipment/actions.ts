"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { run } from "@/lib/action";
import { num, required, str, type ActionState } from "@/lib/form";

function parse(fd: FormData) {
  return {
    name: required(str(fd, "name"), "Name"),
    batchSize: required(num(fd, "batchSize"), "Batch size"),
    boilOffRate: required(num(fd, "boilOffRate"), "Boil-off rate"),
    mashTunDeadspace: num(fd, "mashTunDeadspace") ?? 0,
    trubLoss: num(fd, "trubLoss") ?? 0,
    efficiency: required(num(fd, "efficiency"), "Efficiency"),
  };
}

export async function createEquipment(_: ActionState, fd: FormData) {
  return run(async () => {
    await db.equipmentProfile.create({ data: parse(fd) });
    revalidatePath("/equipment");
    redirect("/equipment");
  });
}

export async function updateEquipment(id: number, _: ActionState, fd: FormData) {
  return run(async () => {
    await db.equipmentProfile.update({ where: { id }, data: parse(fd) });
    revalidatePath("/equipment");
    redirect("/equipment");
  });
}

export async function deleteEquipment(id: number, _: ActionState) {
  return run(async () => {
    await db.equipmentProfile.delete({ where: { id } });
    revalidatePath("/equipment");
    redirect("/equipment");
  });
}
