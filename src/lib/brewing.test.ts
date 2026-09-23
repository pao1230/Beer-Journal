import { describe, expect, it } from "vitest";
import { abv, batchLabel, gravityWarnings, preBoilVolume, tempWarning, validateGravity } from "./brewing";

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
    expect(validateGravity(1.026, 1.072)).toMatch(/FG must be lower/);
    expect(validateGravity(1.05, 1.05)).toMatch(/FG must be lower/);
  });
  it("rejects values that look like points instead of SG", () => {
    expect(validateGravity(72, null)).toMatch(/looks wrong/);
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
