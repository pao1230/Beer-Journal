import type { IngredientType } from "@/generated/prisma/enums";

/**
 * Starter ingredients from WAS Homebrew (washomebrew.com, Thailand), ingredient category as of
 * Sept 2026. Malt colors are the shop's EBC; hop alpha acid is the midpoint of the shop's range
 * (the range is kept in notes). Values the shop doesn't list — malt potential, yeast attenuation
 * and flocculation — come from the maltster's or yeast maker's data sheets. Grape juices and
 * wine concentrates are left out.
 */
export const CATALOG_SUPPLIER = "WAS Homebrew";

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
};

const castle = (name: string, ebc: number, potential: number, notes?: string): CatalogItem => ({
  name: `Château ${name}`,
  type: "GRAIN",
  brand: "Castle Malting",
  ebc,
  potential,
  notes,
});

const hop = (name: string, low: number, high: number): CatalogItem => ({
  name,
  type: "HOP",
  brand: "Yakima Chief",
  alphaAcid: Math.round(((low + high) / 2) * 10) / 10,
  form: "Pellet",
  notes: `AA ${low}–${high}%`,
});

export const CATALOG: CatalogItem[] = [
  castle("Pilsen 2RS", 3.25, 1.037, "EBC 3.0–3.5"),
  castle("Pale Ale", 8.5, 1.037, "EBC 7–10"),
  castle("Munich Light", 15, 1.036, "EBC 13–17"),
  castle("Wheat Blanc", 4.5, 1.038, "EBC 3.5–5.5"),
  castle("Cara Clair", 5, 1.035, "EBC 3–7"),
  castle("Biscuit", 50, 1.035),
  castle("Crystal", 150, 1.034),
  castle("Chocolat", 950, 1.03, "EBC 900–1000"),
  castle("Roasted Barley", 1200, 1.025, "EBC 1000–1400"),
  castle("Oat Flakes", 4, 1.033, "EBC 3–5"),
  {
    name: "Light Dried Malt Extract (DME)",
    type: "GRAIN",
    brand: "Muntons",
    ebc: 15,
    potential: 1.044,
    notes: "EBC 10–20 · add at the boil",
  },

  hop("Citra", 10, 15),
  hop("Mosaic", 11.5, 13.5),
  hop("Simcoe", 12, 14),
  hop("Centennial", 9.5, 11.5),
  hop("Hallertau Mittelfrüh", 3, 5.5),
  hop("Tettnang", 3, 5.8),
  hop("Saaz", 2.5, 4.5),
  hop("Fuggle", 2.4, 6.1),
  hop("UK Golding", 5, 6),

  { name: "Safale US-05", type: "YEAST", brand: "Fermentis", attenuation: 81, form: "Dry", flocculation: "Medium" },
  { name: "Saflager S-23", type: "YEAST", brand: "Fermentis", attenuation: 82, form: "Dry", flocculation: "High" },
  { name: "Saflager S-189", type: "YEAST", brand: "Fermentis", attenuation: 82, form: "Dry", flocculation: "High" },
  { name: "M20 Bavarian Wheat", type: "YEAST", brand: "Mangrove Jack's", attenuation: 74, form: "Dry", flocculation: "Low" },
  { name: "M31 Belgian Tripel", type: "YEAST", brand: "Mangrove Jack's", attenuation: 84, form: "Dry", flocculation: "Medium" },
  { name: "M66 Hophead Ale", type: "YEAST", brand: "Mangrove Jack's", attenuation: 80, form: "Dry", flocculation: "Medium" },
  {
    name: "LalBrew Voss Kveik",
    type: "YEAST",
    brand: "Lallemand",
    attenuation: 79,
    form: "Dry",
    flocculation: "High",
    notes: "25–40 °C, best at 35–40 °C",
  },
  { name: "M05 Mead", type: "YEAST", brand: "Mangrove Jack's", form: "Dry", notes: "Mead" },
  { name: "Lalvin EC-1118", type: "YEAST", brand: "Lallemand", form: "Dry", notes: "Wine / cider" },
  { name: "Lalvin 71B", type: "YEAST", brand: "Lallemand", form: "Dry", notes: "Wine / cider" },

  { name: "Calcium Chloride (CaCl2)", type: "WATER", waterSalt: "CaCl2" },
  { name: "Gypsum (CaSO4)", type: "WATER", waterSalt: "CaSO4" },
  { name: "Epsom Salt (MgSO4)", type: "WATER", waterSalt: "MgSO4" },
  { name: "Sodium Bicarbonate (NaHCO3)", type: "WATER", waterSalt: "NaHCO3", notes: "Baking soda" },
  { name: "Lactic Acid", type: "WATER", notes: "Lowers mash / sparge pH" },

  { name: "Dextrose", type: "OTHER", potential: 1.046, notes: "Corn sugar · priming or boil" },
  { name: "Irish Moss", type: "OTHER" },
  { name: "Yeast Nutrient (DAP)", type: "OTHER" },
];

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
  return items.map(({ ebc, ...c }) => ({
    ...c,
    color: ebc == null ? undefined : ebcToLovibond(ebc),
    supplier: CATALOG_SUPPLIER,
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
