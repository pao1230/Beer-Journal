import { describe, expect, it } from "vitest";
import { findMatch, nameScore, suggestMatches, type MatchCandidate } from "./ingredient-match";

const list: MatchCandidate[] = [
  { id: 1, name: "Citra", type: "HOP", brand: "Yakima Chief", isArchived: false },
  { id: 2, name: "Citra Lupomax", type: "HOP", brand: "BarthHaas", isArchived: false },
  { id: 3, name: "Château Pale Ale", type: "GRAIN", brand: "Castle Malting", isArchived: false },
  { id: 4, name: "Safale US-05", type: "YEAST", brand: "Fermentis", isArchived: false },
  { id: 5, name: "Barrett Burston Pale", type: "GRAIN", brand: null, isArchived: false },
];

describe("ingredient matching", () => {
  it("ignores words like Hop and Malt and punctuation", () => {
    expect(nameScore("Citra Hop", "Citra")).toBe(1);
    expect(nameScore("SafAle US-05", "Safale US-05")).toBe(1);
    expect(nameScore("US05", "US-05")).toBe(0.95);
  });
  it("matches only near-identical names of the same type", () => {
    expect(findMatch("Citra Hop", "HOP", list)?.id).toBe(1);
    expect(findMatch("Citra Hop", "GRAIN", list)).toBeNull();
    expect(findMatch("SafAle US-05", "YEAST", list)?.id).toBe(4);
    expect(findMatch("Pale Ale Malt", "GRAIN", list)).toBeNull();
  });
  it("suggests similar ingredients, best first", () => {
    expect(suggestMatches("Pale Ale Malt", "GRAIN", list).map((c) => c.id)).toEqual([3]);
    expect(suggestMatches("Citra Hop", "HOP", list).map((c) => c.id)).toEqual([1, 2]);
  });
});
