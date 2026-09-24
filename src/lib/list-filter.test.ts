import { describe, expect, it } from "vitest";
import { filterHref, parseTypes, toggleType } from "./list-filter";

describe("parseTypes", () => {
  it("accepts one or many, drops unknown and duplicates, keeps display order", () => {
    expect(parseTypes(undefined)).toEqual([]);
    expect(parseTypes("HOP")).toEqual(["HOP"]);
    expect(parseTypes(["YEAST", "nope", "GRAIN", "YEAST"])).toEqual(["GRAIN", "YEAST"]);
  });
});

describe("toggleType", () => {
  it("adds a type that isn't selected and removes one that is", () => {
    expect(toggleType([], "HOP")).toEqual(["HOP"]);
    expect(toggleType(["HOP"], "GRAIN")).toEqual(["GRAIN", "HOP"]);
    expect(toggleType(["GRAIN", "HOP"], "GRAIN")).toEqual(["HOP"]);
  });
});

describe("filterHref", () => {
  it("keeps other filters and repeats type", () => {
    expect(filterHref("/inventory", { q: "malt", out: undefined }, ["GRAIN", "HOP"])).toBe(
      "/inventory?q=malt&type=GRAIN&type=HOP",
    );
    expect(filterHref("/ingredients", { q: undefined }, [])).toBe("/ingredients");
  });
});
