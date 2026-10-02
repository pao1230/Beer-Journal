"use client";

import { itemsToLines, type PdfTextItem } from "./pdf-lines";
import { parseRecipeText, type ImportCheck, type KnownIngredient } from "./parse-text";
import { findRecipeCode, parseRecipeFile, type RecipeData } from "@/lib/recipe-file";

export type ImportSource = "file" | "code" | "pdf" | "text";
export type ImportResult = { data: RecipeData; checks: ImportCheck[]; source: ImportSource; fileName: string | null };

/** Text of every page of a PDF, read in the browser (the file never leaves the device). */
async function pdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    lines.push(...itemsToLines(content.items.filter((i): i is PdfTextItem & typeof i => "str" in i)));
  }
  await doc.cleanup();
  return lines.join("\n");
}

/** Text from a sheet this app exported has an exact recipe code; anything else is parsed. */
export async function readText(text: string, known: KnownIngredient[], fileName: string | null, source: "pdf" | "text"): Promise<ImportResult> {
  const exact = await findRecipeCode(text);
  if (exact) return { data: exact, checks: [], source: "code", fileName };
  return { ...parseRecipeText(text, known), source, fileName };
}

export async function readRecipeFile(file: File, known: KnownIngredient[]): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const text = await pdfText(file);
    if (!text.trim()) throw new Error("This PDF has no text to read (is it a scanned image?) — try pasting the recipe as text instead");
    return readText(text, known, file.name, "pdf");
  }
  const text = await file.text();
  if (name.endsWith(".json") || text.trimStart().startsWith("{")) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("This file isn't valid JSON");
    }
    return { data: parseRecipeFile(json).recipe, checks: [], source: "file", fileName: file.name };
  }
  return readText(text, known, file.name, "text");
}
