import type { IngredientType } from "@/generated/prisma/enums";
import { CATALOG } from "./catalog-data";

export { CATALOG };

/** Shops the starter catalog comes from; see catalog-data.ts. */
export const CATALOG_SUPPLIERS = ["WAS Homebrew", "Craft Components"];

export type CatalogItem = {
  name: string;
  type: IngredientType;
  brand?: string;
  notes?: string;
  ebc?: number;
  potential?: number;
  alphaAcid?: number;
  form?: string;
  attenuation?: number;
  flocculation?: string;
  waterSalt?: string;
  unfermentable?: boolean;
  /** Shops that sell it. */
  suppliers: string[];
};

/** EBC → degrees Lovibond (via SRM = EBC × 0.508), to one decimal. */
export function ebcToLovibond(ebc: number) {
  return Math.round(((ebc * 0.508 + 0.76) / 1.3546) * 10) / 10;
}

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

type Existing = { name: string; type: IngredientType; waterSalt: string | null };

/**
 * Catalog items the database doesn't have yet. An ingredient counts as present when the same
 * type has the same name (ignoring case and punctuation), or — for water salts — the same salt.
 */
export function missingFromCatalog(existing: Existing[], catalog: CatalogItem[] = CATALOG) {
  const names = new Set(existing.map((e) => `${e.type}:${normalize(e.name)}`));
  const salts = new Set(existing.flatMap((e) => (e.waterSalt ? [e.waterSalt] : [])));
  return catalog.filter(
    (c) => !names.has(`${c.type}:${normalize(c.name)}`) && !(c.waterSalt && salts.has(c.waterSalt)),
  );
}

export const STOCK_UNIT: Record<IngredientType, string> = { GRAIN: "kg", HOP: "g", YEAST: "pkg", WATER: "g", OTHER: "g" };

/** Row data for `ingredient.createMany`. */
export function catalogRows(items: CatalogItem[]) {
  return items.map(({ ebc, suppliers, ...c }) => ({
    ...c,
    color: ebc == null ? undefined : ebcToLovibond(ebc),
    supplier: suppliers.join(", "),
    stockUnit: c.name === "Lactic Acid" ? "ml" : STOCK_UNIT[c.type],
  }));
}

/** Adds the catalog items that are missing; returns how many were added. Safe to run again. */
export async function importCatalog(db: {
  ingredient: {
    findMany(args: { select: { name: true; type: true; waterSalt: true } }): Promise<Existing[]>;
    createMany(args: { data: ReturnType<typeof catalogRows> }): Promise<{ count: number }>;
  };
}) {
  const existing = await db.ingredient.findMany({ select: { name: true, type: true, waterSalt: true } });
  const missing = missingFromCatalog(existing);
  if (missing.length === 0) return 0;
  return (await db.ingredient.createMany({ data: catalogRows(missing) })).count;
}
