import { describe, expect, it } from "vitest";
import { CATALOG, catalogRows, ebcToLovibond, importCatalog, missingFromCatalog } from "./catalog";
import { WATER_SALTS } from "./calc";

describe("ebcToLovibond", () => {
  it("matches the shop's own conversions", () => {
    expect(ebcToLovibond(150)).toBe(56.8); // shop lists 57.1 °L
    expect(ebcToLovibond(3.25)).toBe(1.8); // shop lists 1.7–1.9 °L
  });
});

describe("catalog data", () => {
  it("has unique names per type and usable values", () => {
    const keys = CATALOG.map((c) => `${c.type}:${c.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CATALOG) {
      if (c.type === "GRAIN") expect(c.potential).toBeGreaterThan(1);
      if (c.type === "HOP") expect(c.alphaAcid).toBeGreaterThan(0);
      if (c.waterSalt) expect(Object.keys(WATER_SALTS)).toContain(c.waterSalt);
    }
  });

  it("builds rows with Lovibond color, supplier and stock unit", () => {
    const [pils] = catalogRows(CATALOG.filter((c) => c.name === "Château Pilsen 2RS"));
    expect(pils).toMatchObject({ color: 1.8, supplier: "WAS Homebrew", stockUnit: "kg", brand: "Castle Malting" });
    expect(pils).not.toHaveProperty("ebc");
    const [lactic] = catalogRows(CATALOG.filter((c) => c.name === "Lactic Acid"));
    expect(lactic.stockUnit).toBe("ml");
  });
});

describe("missingFromCatalog", () => {
  it("skips names already present, ignoring case and punctuation", () => {
    const missing = missingFromCatalog([
      { name: "citra", type: "HOP", waterSalt: null },
      { name: "Safale US05", type: "YEAST", waterSalt: null },
    ]);
    expect(missing.map((c) => c.name)).not.toContain("Citra");
    expect(missing.map((c) => c.name)).not.toContain("Safale US-05");
    expect(missing).toHaveLength(CATALOG.length - 2);
  });

  it("matches water salts by salt, and names only within the same type", () => {
    const missing = missingFromCatalog([
      { name: "Baking soda", type: "WATER", waterSalt: "NaHCO3" },
      { name: "Citra", type: "OTHER", waterSalt: null },
    ]);
    expect(missing.some((c) => c.waterSalt === "NaHCO3")).toBe(false);
    expect(missing.some((c) => c.name === "Citra")).toBe(true);
  });
});

describe("importCatalog", () => {
  it("adds only what's missing and is a no-op the second time", async () => {
    const rows: { name: string; type: never; waterSalt: string | null }[] = [];
    const db = {
      ingredient: {
        findMany: async () => rows,
        createMany: async ({ data }: { data: ReturnType<typeof catalogRows> }) => {
          rows.push(...data.map((d) => ({ name: d.name, type: d.type as never, waterSalt: d.waterSalt ?? null })));
          return { count: data.length };
        },
      },
    };
    expect(await importCatalog(db)).toBe(CATALOG.length);
    expect(await importCatalog(db)).toBe(0);
  });
});
