import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecipeText } from "./import/parse-text";
import {
  decodeRecipePayload,
  encodeRecipeCode,
  encodeRecipePayload,
  findRecipeCode,
  parseRecipeFile,
  scaleRecipeData,
  toRecipeFile,
} from "./recipe-file";

const { data } = parseRecipeText(readFileSync(new URL("./import/fixtures/citra-simcoe-ipa.txt", import.meta.url), "utf8"));

describe("recipe file", () => {
  it("round-trips through JSON", () => {
    const file = JSON.parse(JSON.stringify(toRecipeFile(data)));
    expect(parseRecipeFile(file).recipe).toEqual(data);
  });

  it("rejects other JSON", () => {
    expect(() => parseRecipeFile({ hello: 1 })).toThrow("isn't a Brewing Journal recipe file");
    expect(() => parseRecipeFile({ format: "brewing-journal-recipe", schemaVersion: 1, recipe: {} })).toThrow("damaged");
  });

  it("scales amounts and keeps targets", () => {
    const half = scaleRecipeData(data, 10, null);
    expect(half.batchSize).toBe(10);
    expect(half.ingredients[0].amount).toBe(2.6);
    expect(half.targetOg).toBe(data.targetOg);
    expect(half.mashWaterL).toBe(7.8);
  });
});

describe("recipe code", () => {
  it("round-trips and stays small enough for a QR code", async () => {
    const payload = await encodeRecipePayload(data);
    expect(payload.length).toBeLessThan(1500);
    expect(await decodeRecipePayload(payload)).toEqual(data);
  });

  it("is found in text extracted from a PDF, even when wrapped over lines", async () => {
    const code = await encodeRecipeCode(data);
    const wrapped = `Some footer text\n${code.slice(0, 40)}\n${code.slice(40, 90)} ${code.slice(90)}\nPage 2`;
    expect(await findRecipeCode(wrapped)).toEqual(data);
    expect(await findRecipeCode("no code here")).toBeNull();
    expect(await findRecipeCode("BJR1:garbage:BJR")).toBeNull();
  });
});
