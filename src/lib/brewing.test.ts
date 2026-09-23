import { describe, expect, it } from "vitest";
import {
  abv,
  attenuation,
  batchLabel,
  fermentationSeries,
  gravityWarnings,
  preBoilVolume,
  roundAmount,
  scaleWater,
  tempWarning,
  validateGravity,
} from "./brewing";

describe("abv", () => {
  it("uses the standard (OG - FG) * 131.25 formula", () => {
    expect(abv(1.072, 1.026)).toBeCloseTo(6.04, 2);
  });
  it("is null until both gravities are known", () => {
    expect(abv(1.072, null)).toBeNull();
  });
});

describe("validateGravity", () => {
  it("rejects FG at or above OG", () => {
    expect(validateGravity(1.026, 1.072)?.message).toMatch(/FG must be lower/);
    expect(validateGravity(1.05, 1.05)?.message).toMatch(/FG must be lower/);
  });
  it("rejects values that look like points instead of SG", () => {
    expect(validateGravity(72, null)?.message).toMatch(/looks wrong/);
  });
  it("accepts a normal pair or partial data", () => {
    expect(validateGravity(1.072, 1.026)).toBeNull();
    expect(validateGravity(null, 1.01)).toBeNull();
  });
});

describe("preBoilVolume", () => {
  it("adds trub loss and boil-off for the boil length", () => {
    expect(preBoilVolume(20, 60, { boilOffRate: 2.5, trubLoss: 1 })).toBeCloseTo(23.5);
    expect(preBoilVolume(20, 90, { boilOffRate: 2, trubLoss: 0 })).toBeCloseTo(23);
  });
  it("needs an equipment profile", () => {
    expect(preBoilVolume(20, 60, null)).toBeNull();
  });
});

describe("deviation warnings", () => {
  it("flags OG more than 5 points off target", () => {
    const w = gravityWarnings({ targetOg: 1.074, targetFg: 1.026, actualOg: 1.066, actualFg: 1.026 });
    expect(w).toHaveLength(1);
    expect(w[0].message).toBe("OG lower than target");
  });
  it("ignores small differences", () => {
    expect(gravityWarnings({ targetOg: 1.074, targetFg: 1.026, actualOg: 1.072, actualFg: 1.024 })).toEqual([]);
  });
  it("flags temperatures more than 2°C off", () => {
    expect(tempWarning("Mash temp", 69, 70)).toBeNull();
    expect(tempWarning("Mash temp", 69, 71.5)?.message).toBe("Mash temp higher than target");
  });
});

it("formats batch labels like the plan", () => {
  expect(batchLabel("Sweet Stout", 2)).toBe("Sweet Stout #002");
});

describe("fermentationSeries", () => {
  const brewDate = new Date("2026-09-19T12:00:00");
  const day = (n: number) => new Date(brewDate.getTime() + n * 86_400_000);
  it("puts OG at day 0 and maps log dates to days", () => {
    const s = fermentationSeries(brewDate, 1.072, [
      { date: day(1), gravity: 1.06, temperature: 18.2, ph: null },
      { date: day(3), gravity: null, temperature: 18.4, ph: 4.4 },
    ]);
    expect(s.gravity).toEqual([{ x: 0, y: 1.072 }, { x: 1, y: 1.06 }]);
    expect(s.temperature).toEqual([{ x: 1, y: 18.2 }, { x: 3, y: 18.4 }]);
    expect(s.ph).toEqual([{ x: 3, y: 4.4 }]);
  });
  it("doesn't duplicate day 0 when a gravity was logged on brew day", () => {
    const s = fermentationSeries(brewDate, 1.072, [{ date: day(0), gravity: 1.07, temperature: null, ph: null }]);
    expect(s.gravity).toEqual([{ x: 0, y: 1.07 }]);
  });
});

it("computes apparent attenuation", () => {
  expect(attenuation(1.072, 1.026)).toBeCloseTo(63.9, 1);
  expect(attenuation(1.05, null)).toBeNull();
});

describe("recipe scaling", () => {
  it("rounds to weighable amounts", () => {
    expect(roundAmount(2.1, "kg")).toBe(2.1);
    expect(roundAmount(2.1234, "kg")).toBe(2.12);
    expect(roundAmount(14.04, "g")).toBe(14);
    expect(roundAmount(249.6, "g")).toBe(250);
    expect(roundAmount(0.5, "pkg")).toBe(1);
    expect(roundAmount(1.2, "pkg")).toBe(2);
    expect(roundAmount(0.4, "tsp")).toBe(0.5);
  });

  it("keeps fixed losses when halving a batch", () => {
    // 17.8 + 7.2 = 25 L total; fixed losses = 2.5 boil-off + 1 trub + 0.5 deadspace = 4 L
    const w = scaleWater({ mashWaterL: 17.8, spargeWaterL: 7.2, boilTime: 60 }, { boilOffRate: 2.5, trubLoss: 1, mashTunDeadspace: 0.5 }, 0.5);
    expect(w.mashWaterL).toBe(8.9);
    expect((w.mashWaterL ?? 0) + (w.spargeWaterL ?? 0)).toBeCloseTo((25 - 4) * 0.5 + 4, 1);
  });

  it("scales linearly without an equipment profile", () => {
    expect(scaleWater({ mashWaterL: 10, spargeWaterL: 5, boilTime: 60 }, null, 2)).toEqual({ mashWaterL: 20, spargeWaterL: 10 });
  });
});
