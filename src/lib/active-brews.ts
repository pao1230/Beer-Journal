import "server-only";
import { db } from "@/lib/db";
import { batchLabel } from "@/lib/brewing";
import type { BrewStatus } from "@/generated/prisma/enums";

/** Brews that aren't finished yet: planned or in progress. */
export const ACTIVE_STATUSES: BrewStatus[] = ["PLANNING", "BREWING", "FERMENTING", "CONDITIONING"];

export type ActiveUse = { sessionId: number; label: string; batch: string; status: BrewStatus };

/** For each ingredient, the unfinished brews that use it (newest brew first). */
export async function loadActiveBrewUse() {
  const lines = await db.brewIngredient.findMany({
    where: { ingredientId: { not: null }, brewSession: { status: { in: ACTIVE_STATUSES } } },
    select: {
      ingredientId: true,
      brewSession: { select: { id: true, status: true, batchNumber: true, brewDate: true, recipe: { select: { name: true } } } },
    },
    orderBy: { brewSession: { brewDate: "desc" } },
  });
  const out = new Map<number, ActiveUse[]>();
  for (const l of lines) {
    const s = l.brewSession;
    const list = out.get(l.ingredientId!) ?? [];
    if (!list.some((u) => u.sessionId === s.id)) list.push({
        sessionId: s.id,
        label: batchLabel(s.recipe.name, s.batchNumber),
        batch: `#${String(s.batchNumber).padStart(3, "0")}`,
        status: s.status,
      });
    out.set(l.ingredientId!, list);
  }
  return out;
}
