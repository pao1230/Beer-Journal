import { describe, expect, it } from "vitest";
import { allTermsIn, parseQuery, splitMatches } from "./search";

describe("parseQuery", () => {
  it("splits words and keeps quoted phrases", () => {
    expect(parseQuery('mash "strike water" temp')).toEqual(["mash", "strike water", "temp"]);
  });
  it("works for Thai text without spaces between words", () => {
    expect(parseQuery("อุณหภูมิ")).toEqual(["อุณหภูมิ"]);
  });
  it("drops duplicates and empty input", () => {
    expect(parseQuery("  Mash mash ")).toEqual(["Mash"]);
    expect(parseQuery("")).toEqual([]);
  });
});

it("builds an AND-of-ORs filter", () => {
  expect(allTermsIn(["a", "b"], ["x", "y"])).toEqual({
    AND: [
      { OR: [{ x: { contains: "a", mode: "insensitive" } }, { y: { contains: "a", mode: "insensitive" } }] },
      { OR: [{ x: { contains: "b", mode: "insensitive" } }, { y: { contains: "b", mode: "insensitive" } }] },
    ],
  });
});

describe("splitMatches", () => {
  it("marks case-insensitive matches", () => {
    expect(splitMatches("Keep a backup Hydrometer", ["hydrometer"])).toEqual([
      { text: "Keep a backup ", match: false },
      { text: "Hydrometer", match: true },
    ]);
  });
  it("escapes regex characters in terms", () => {
    expect(splitMatches("pH (5.4)", ["(5.4)"])).toEqual([
      { text: "pH ", match: false },
      { text: "(5.4)", match: true },
    ]);
  });
  it("matches inside Thai text", () => {
    expect(splitMatches("ทำให้อุณหภูมิด้านบน", ["อุณหภูมิ"]).filter((p) => p.match)).toEqual([{ text: "อุณหภูมิ", match: true }]);
  });
});
