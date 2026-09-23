import { describe, expect, it } from "vitest";
import { dayTicks, niceTicks } from "./chart";

describe("niceTicks", () => {
  it("covers a gravity range with clean steps", () => {
    const t = niceTicks(1.026, 1.072);
    expect(t[0]).toBeLessThanOrEqual(1.026);
    expect(t.at(-1)).toBeGreaterThanOrEqual(1.072);
    expect(t).toEqual([1.02, 1.04, 1.06, 1.08]);
  });
  it("covers a temperature range", () => {
    expect(niceTicks(17.8, 19.2)).toEqual([17.5, 18, 18.5, 19, 19.5]);
  });
  it("handles a flat series", () => {
    const t = niceTicks(18, 18);
    expect(t.length).toBeGreaterThan(1);
    expect(t[0]).toBeLessThan(18);
    expect(t.at(-1)).toBeGreaterThan(18);
  });
});

describe("dayTicks", () => {
  it("uses every day for short spans", () => {
    expect(dayTicks(0, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("thins out long spans", () => {
    expect(dayTicks(0, 28)).toEqual([0, 5, 10, 15, 20, 25]);
  });
});
