"use server";

import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import {
  cleanDrafts,
  DEFAULT_CHECKLIST,
  parseChecklist,
  STATUSES,
  type ChecklistSection,
  type ChecklistStatus,
  type SectionDraft,
} from "@/lib/checklist";
import { UserError } from "@/lib/user-error";

// Called from event handlers, not forms; the page keeps its own state, so nothing revalidates.

function id(value: unknown) {
  if (!Number.isInteger(value)) throw new Error("Invalid id");
  return value as number;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function qty(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Invalid amount");
  return value;
}

export async function loadChecklist(): Promise<ChecklistSection[]> {
  const sections = await db.checklistSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? "",
    items: s.items.map((i) => ({
      id: i.id,
      name: i.name,
      note: i.note ?? "",
      quantity: i.quantity,
      unit: i.unit ?? "",
      status: i.status,
      missingQty: i.status === "MISSING" ? i.missingQty : null,
    })),
  }));
}

/** `missingQty` is kept only with MISSING; any other status clears it. */
export async function setItemStatus(itemId: number, status: ChecklistStatus, missingQty: number | null = null) {
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  await db.checklistItem.update({
    where: { id: id(itemId) },
    data: { status, missingQty: status === "MISSING" ? qty(missingQty) : null },
  });
}

export async function setMissingQty(itemId: number, missingQty: number | null) {
  await db.checklistItem.update({ where: { id: id(itemId) }, data: { missingQty: qty(missingQty) } });
}

/**
 * A section's toggle button. "check" ticks only items not checked yet, so a missing one stays
 * missing; "clear" unticks every item in the section.
 */
export async function toggleSection(sectionId: number, mode: "check" | "clear") {
  const where = { sectionId: id(sectionId) };
  if (mode === "clear") await db.checklistItem.updateMany({ where, data: { status: "TODO", missingQty: null } });
  else await db.checklistItem.updateMany({ where: { ...where, status: "TODO" }, data: { status: "OK" } });
}

export async function resetStatuses() {
  await db.checklistItem.updateMany({ data: { status: "TODO", missingQty: null } });
}

export async function addSection(title: string) {
  const last = await db.checklistSection.aggregate({ _max: { sortOrder: true } });
  const sec = await db.checklistSection.create({
    data: { title: text(title), sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  return sec.id;
}

export async function updateSection(sectionId: number, data: { title?: string; description?: string }) {
  await db.checklistSection.update({
    where: { id: id(sectionId) },
    data: {
      ...(data.title !== undefined && { title: text(data.title) }),
      ...(data.description !== undefined && { description: text(data.description) || null }),
    },
  });
}

export async function deleteSection(sectionId: number) {
  await db.checklistSection.delete({ where: { id: id(sectionId) } });
}

export async function addItem(
  sectionId: number,
  data: { name: string; note: string; quantity: number | null; unit: string },
) {
  const last = await db.checklistItem.aggregate({ where: { sectionId: id(sectionId) }, _max: { sortOrder: true } });
  const item = await db.checklistItem.create({
    data: {
      sectionId,
      name: text(data.name),
      note: text(data.note) || null,
      quantity: qty(data.quantity),
      unit: text(data.unit) || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  return item.id;
}

export async function updateItem(
  itemId: number,
  data: { name?: string; note?: string; quantity?: number | null; unit?: string },
) {
  await db.checklistItem.update({
    where: { id: id(itemId) },
    data: {
      ...(data.name !== undefined && { name: text(data.name) }),
      ...(data.note !== undefined && { note: text(data.note) || null }),
      ...(data.quantity !== undefined && { quantity: qty(data.quantity) }),
      ...(data.unit !== undefined && { unit: text(data.unit) || null }),
    },
  });
}

export async function deleteItem(itemId: number) {
  await db.checklistItem.delete({ where: { id: id(itemId) } });
}

/** Saves the whole order at once: sections in order, each with its items in order. */
export async function saveOrder(layout: { id: number; itemIds: number[] }[]) {
  await db.$transaction(
    layout.flatMap((sec, si) => [
      db.checklistSection.update({ where: { id: id(sec.id) }, data: { sortOrder: si } }),
      ...sec.itemIds.map((itemId, ii) =>
        db.checklistItem.update({ where: { id: id(itemId) }, data: { sectionId: sec.id, sortOrder: ii } }),
      ),
    ]),
  );
}

async function replaceAll(drafts: SectionDraft[]) {
  await db.$transaction(async (tx) => {
    await tx.checklistSection.deleteMany();
    for (const [si, s] of cleanDrafts(drafts).entries()) {
      await tx.checklistSection.create({
        data: {
          title: s.title,
          description: s.description || null,
          sortOrder: si,
          items: {
            create: s.items.map((i, ii) => ({
              name: i.name,
              note: i.note || null,
              quantity: i.quantity,
              unit: i.unit || null,
              sortOrder: ii,
            })),
          },
        },
      });
    }
  });
  return loadChecklist();
}

export async function restoreDefaultChecklist() {
  return replaceAll(DEFAULT_CHECKLIST);
}

/** Replaces every section with the JSON backup; statuses start over. */
export async function importChecklist(json: string): Promise<{ sections?: ChecklistSection[]; error?: string }> {
  try {
    return { sections: await replaceAll(parseChecklist(json)) };
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    const { t } = await getI18n();
    return { error: t(e.key, e.vars) };
  }
}
