import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Stout, "sweet"')).toBe('"Stout, ""sweet"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises formula injection in text but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2 kg")).toBe("'-2 kg");
    expect(csvCell(-4.2)).toBe("-4.2");
  });
  it("keeps Thai text and adds a BOM for Excel", () => {
    const out = toCsv(["note"], [["อุณหภูมิ"], [null]]);
    expect(out.startsWith("﻿note\r\nอุณหภูมิ\r\n")).toBe(true);
  });
});
