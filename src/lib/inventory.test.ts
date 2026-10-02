import { describe, expect, it } from "vitest";
import { lineCost, shortages, shortfall, summarize } from "./inventory";

const rows = [
  { ingredientId: 1, amount: 25, totalCost: 1250, reason: "PURCHASE" }, // 50/kg
  { ingredientId: 1, amount: 25, totalCost: 1500, reason: "PURCHASE" }, // 60/kg
  { ingredientId: 1, amount: -4.2, totalCost: null, reason: "BREW" },
  { ingredientId: 2, amount: 3, totalCost: null, reason: "ADJUSTMENT" },
];

describe("inventory", () => {
  const stock = summarize(rows, new Map([[1, "kg"], [2, "pkg"], [3, "g"]]));
  it("sums the ledger and averages purchase cost", () => {
    expect(stock.get(1)!.onHand).toBeCloseTo(45.8);
    expect(stock.get(1)!.avgCost).toBeCloseTo(55);
    expect(stock.get(2)).toEqual({ stockUnit: "pkg", onHand: 3, avgCost: null });
    expect(stock.get(3)).toEqual({ stockUnit: "g", onHand: 0, avgCost: null });
  });
  it("prices a line in a different but compatible unit", () => {
    expect(lineCost(500, "g", stock.get(1))).toBeCloseTo(27.5);
    expect(lineCost(1, "L", stock.get(1))).toBeNull();
    expect(lineCost(1, "pkg", stock.get(2))).toBeNull();
  });
  it("reports how much is missing", () => {
    expect(shortfall(4200, "g", stock.get(1))).toBe(0);
    expect(shortfall(50, "kg", stock.get(1))).toBeCloseTo(4.2);
    expect(shortfall(1, "pkg", undefined)).toBeNull();
  });
});

describe("shortages", () => {
  it("totals lines per ingredient in its stock unit", () => {
    const stock = new Map([
      [1, { stockUnit: "g", onHand: 40 }],
      [2, { stockUnit: "kg", onHand: 10 }],
      [3, { stockUnit: null, onHand: 0 }],
    ]);
    const out = shortages(
      [
        { ingredientId: 1, name: "Citra", amount: 25, unit: "g" },
        { ingredientId: 1, name: "Citra", amount: 25, unit: "g" },
        { ingredientId: 2, name: "Pale", amount: 5200, unit: "g" },
        { ingredientId: 3, name: "Untracked", amount: 1, unit: "pkg" },
      ],
      (id) => stock.get(id),
    );
    expect(out).toEqual([{ ingredientId: 1, name: "Citra", need: 50, have: 40, short: 10, unit: "g" }]);
  });
});
