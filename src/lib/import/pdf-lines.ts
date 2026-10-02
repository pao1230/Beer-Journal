// Thai fonts often store raised/lowered vowel and tone marks as private-use glyphs (U+F700–F71A).
const THAI_PUA = [
  0x0e10, 0x0e34, 0x0e35, 0x0e36, 0x0e37, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b,
  0x0e4c, 0x0e0d, 0x0e31, 0x0e4d, 0x0e47, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e38, 0x0e39, 0x0e3a,
];

/** Maps Thai private-use glyphs back to real characters and composes ํ + า into ำ. */
export function fixThaiText(s: string) {
  return s
    .replace(/[\uF700-\uF71A]/g, (c) => String.fromCharCode(THAI_PUA[c.charCodeAt(0) - 0xf700]))
    .replace(/\u0E4D([\u0E48-\u0E4B]?)\u0E32/g, "$1\u0E33");
}

/** A text run from pdf.js `getTextContent()`. */
export type PdfTextItem = { str: string; transform: number[]; width: number; height: number };

/**
 * Rebuilds lines of text from a PDF page. Runs on the same baseline become one line; a wide gap
 * between runs becomes three spaces, so table columns stay apart ("Pale Ale Malt   5.2 kg").
 */
export function itemsToLines(items: PdfTextItem[]): string[] {
  const runs = items
    .filter((i) => i.str.trim() !== "")
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.height) || Math.abs(i.transform[3]) || 10 }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: (typeof runs)[] = [];
  for (const r of runs) {
    const line = lines.find((l) => Math.abs(l[0].y - r.y) <= Math.max(2, 0.3 * Math.min(l[0].h, r.h)));
    if (line) line.push(r);
    else lines.push([r]);
  }
  return lines
    .sort((a, b) => b[0].y - a[0].y)
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      let end: number | null = null;
      for (const r of line) {
        if (end != null) {
          const gap = r.x - end;
          if (gap > Math.max(6, 1.2 * r.h)) out += "   ";
          else if (gap > 0.15 * r.h && !out.endsWith(" ") && !r.str.startsWith(" ")) out += " ";
        }
        out += r.str;
        end = Math.max(end ?? 0, r.x + r.w);
      }
      return fixThaiText(out.trimEnd());
    });
}
