import type { AdditionStage, IngredientType } from "@/generated/prisma/enums";
import { INGREDIENT_TYPES } from "@/lib/brewing";
import { nameScore } from "@/lib/ingredient-match";
import type { RecipeData, RecipeDataIngredient } from "@/lib/recipe-file";

/**
 * Reads a recipe out of free text: text extracted from a PDF recipe sheet, or a recipe pasted
 * from a chat or website, in English and/or Thai. It looks for facts (OG 1.060, "Citra 10g",
 * "65°C (60 min)") rather than a fixed layout, and lists everything it had to guess as checks
 * for the brewer to confirm in the review step.
 */

/** English message key + values; the UI translates it. */
export type ImportCheck = { key: string; vars?: Record<string, string | number> };
export type ParsedRecipe = { data: RecipeData; checks: ImportCheck[] };
export type KnownIngredient = { name: string; type: IngredientType };

type Range = { value: number; text: string; isRange: boolean };

const NUM = String.raw`\d+(?:\.\d+)?`;
const RANGE = String.raw`~?\s*(${NUM})(?:\s*[-–—]\s*(${NUM}))?`;

/** Thai PDFs often lose tone marks and split ำ in two; matching ignores both. */
export function normalizeThai(s: string) {
  return s
    .replace(/[่-์]/g, "")
    .replace(/ํา/g, "ำ")
    .replace(/[–—]/g, "-");
}

const lower = (s: string) => normalizeThai(s).toLowerCase();

function range(a: string, b?: string): Range {
  const x = Number(a);
  if (b == null) return { value: x, text: a, isRange: false };
  const y = Number(b);
  return { value: (x + y) / 2, text: `${a}–${b}`, isRange: x !== y };
}

function matchRange(re: RegExp, s: string): Range | null {
  const m = re.exec(s);
  return m ? range(m[1], m[2]) : null;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

// ---- Ingredient recognition ----

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(kg|kgs|กก\.?|กิโลกรัม|กิโล)$/i, "kg"],
  [/^(g|gr|gram|grams|กรัม)$/i, "g"],
  [/^(ml|มล\.?|มิลลิลิตร)$/i, "ml"],
  [/^(l|liter|liters|litre|litres|ลิตร)$/i, "L"],
  [/^(pkg|pack|packs|packet|packets|sachet|sachets|ซอง|ถุง)$/i, "pkg"],
  [/^(tsp|ช้อนชา)$/i, "tsp"],
  [/^(item|items|tablet|tablets|เม็ด)$/i, "item"],
];
const UNIT_WORDS = String.raw`kgs?|กก\.?|กิโลกรัม|กิโล|grams?|gr|g|กรัม|ml|มล\.?|มิลลิลิตร|liters?|litres?|l|ลิตร|pkg|packs?|packets?|sachets?|ซอง|ถุง|tsp|ช้อนชา|items?|tablets?|เม็ด`;
// An amount such as "5.2 kg", "10g" or "1 ซอง"; not followed by more letters ("12 gallons") or "/kg".
const AMOUNT = new RegExp(String.raw`(?<![\w.])(${NUM})\s*(${UNIT_WORDS})(?![a-z/])`, "gi");

const HAS_AMOUNT = new RegExp(AMOUNT.source, "i");

function unitOf(word: string) {
  return UNIT_ALIASES.find(([re]) => re.test(word))?.[1] ?? null;
}

const HOP_NAMES = [
  "citra", "simcoe", "mosaic", "galaxy", "cascade", "centennial", "chinook", "columbus", "ctz", "zeus", "tomahawk",
  "amarillo", "nelson", "motueka", "riwaka", "nectaron", "saaz", "hallertau", "hallertauer", "tettnang", "tettnanger",
  "magnum", "golding", "goldings", "ekg", "fuggle", "fuggles", "warrior", "el dorado", "idaho 7", "sabro", "strata",
  "talus", "azacca", "ekuanot", "loral", "sorachi", "vic secret", "enigma", "ella", "topaz", "summit", "apollo",
  "willamette", "perle", "northern brewer", "spalt", "mittelfruh", "challenger", "target", "admiral", "bramling",
  "jester", "olicana", "cashmere", "comet", "crystal hop", "denali", "lemondrop", "mandarina", "huell", "polaris",
  "lupomax", "lupulin", "cryo", "hop",
];
const HOP_RE = new RegExp(String.raw`(^|[^a-z])(${HOP_NAMES.join("|")})([^a-z]|$)`, "i");
const YEAST_RE =
  /yeast|ยีสต|safale|saflager|safbrew|safcider|lallemand|lalbrew|wyeast|white labs|imperial|omega|fermentis|mangrove|kveik|nottingham|verdant|voss|\bwlp\s?\d{3}\b|\b(?:us|s|w|t|k|be|wb|bry|m)-?\d{2,3}\b|\bm\d{2}\b/i;
const GRAIN_RE =
  /malt|มอลต|grain|pilsner|pilsen|\bpils\b|munich|vienna|crystal|caramel|\bcara|wheat|oat|barley|flaked|\brye\b|\bdme\b|\blme\b|extract|chocolate|roast|biscuit|aromatic|victory|special b|carafa|honey malt|melanoidin|acidulated|maris otter|golden promise|\bpale\b/i;
const WATER_RE = /gypsum|caso4|cacl2|calcium chloride|calcium sulfate|epsom|mgso4|baking soda|nahco3|\bchalk\b|caco3|\bnacl\b|table salt|campden/i;
const OTHER_RE =
  /irish moss|whirlfloc|protafloc|nutrient|lactose|sugar|dextrose|sucrose|honey|candi|maltodextrin|lactic|phosphoric|acid|gelatin|biofine|fruit|zest|peel|coriander|vanilla|cacao|coffee|spice|salt|น้ำตาล|นำตาล/i;
const FORM_ONLY = /^(?:(?:dry|liquid)\s*(?:yeast)?|pellets?|leaf|whole|cryo|ยีสตแหง|ยีสตน้ำ)$/i;

function classify(name: string, unit: string, hint: Section | null, known: KnownIngredient[]): { type: IngredientType; sure: boolean } {
  let best: KnownIngredient | null = null;
  let bestScore = 0;
  for (const k of known) {
    const s = nameScore(name, k.name);
    if (s > bestScore) [best, bestScore] = [k, s];
  }
  if (best && bestScore >= 0.95) return { type: best.type, sure: true };
  if (WATER_RE.test(name)) return { type: "WATER", sure: true };
  if (/nutrient/i.test(name)) return { type: "OTHER", sure: true };
  if (YEAST_RE.test(name)) return { type: "YEAST", sure: true };
  if (HOP_RE.test(name) && !/malt|มอลต/i.test(name)) return { type: "HOP", sure: true };
  if (GRAIN_RE.test(name) && !OTHER_RE.test(name)) return { type: "GRAIN", sure: true };
  if (OTHER_RE.test(name)) return { type: "OTHER", sure: true };
  if (best && bestScore >= 0.7) return { type: best.type, sure: false };
  if (hint === "grain" || unit === "kg") return { type: "GRAIN", sure: false };
  if (hint === "yeast" || unit === "pkg") return { type: "YEAST", sure: false };
  if ((hint === "schedule" || hint === "ferment" || hint === "hops") && unit === "g") return { type: "HOP", sure: false };
  return { type: "OTHER", sure: false };
}

/** The ingredient name at the end of some text: "ใส่ Citra" → "Citra", "Pale Ale Malt" stays. */
function cleanName(text: string) {
  let s = text
    .replace(/\([^)]*\)?\s*$/, "")
    .replace(/[•*·:：@=\-–—,;]+\s*$/, "")
    .replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "")
    .trim();
  // Prefer the trailing run of Latin words ("ใส Citra" → "Citra").
  const latin = /([A-Za-z0-9][A-Za-z0-9 .'’&/\-()]*)$/.exec(s);
  if (latin && /[A-Za-z]/.test(latin[1])) s = latin[1].trim();
  s = s
    .replace(/^(?:add|then|and|with|plus)\s+/i, "")
    .replace(/^(?:ใส่|ใส|เติม|และ)\s*/, "")
    .replace(/^(?:dry\s*-?\s*hop(?:ping)?|whirlpool|flame\s*-?out|hop\s*stand|first wort|fwh|boil|mash)\b\s*[:：-]?\s*/i, "");
  return s.replace(/[\s:：@\-–—]+$/, "").trim();
}

// ---- Sections ----

type Section = "grain" | "yeast" | "hops" | "water" | "schedule" | "ferment" | "keg" | "serving" | "notes";

const SECTION_KEYWORDS: [Section, RegExp][] = [
  ["notes", /💡|highlights|จุดเดน|^notes\b|หมายเหตุ|tasting/],
  ["hops", /total hops|ฮอปทั้งหมด|hop totals/],
  ["schedule", /mash\s*&\s*boil|boil schedule|mash schedule|hop schedule|ตารางการต/],
  ["grain", /malts?\b|grains?\b|grain bill|มอลต/],
  ["yeast", /yeast|ยีสต/],
  ["water", /water profile|water\b|ปริมาณนำ|การคำนวณ/],
  ["ferment", /fermentation|การหมัก/],
  ["keg", /kegging|carbonation guide|อัดแกส/],
  ["serving", /serving|เสิรฟ|เสิร์ฟ/],
];

function headingSections(segment: string): Section[] {
  const s = lower(segment);
  const numbered = /^\s*\d+\.\s+\S/.test(s) && !/\d+\s*(?:kg|g|กรัม|ลิตร|l)\b/.test(s);
  const short = s.split(/\s+/).length <= 5 && !/\d/.test(s);
  const emoji = s.startsWith("💡");
  if (!numbered && !short && !emoji) return [];
  // A numbered step inside a section ("1. Primary fermentation: …") is not a new section.
  if (numbered && /:\s*\S/.test(s) && !emoji) return [];
  return SECTION_KEYWORDS.filter(([, re]) => re.test(s)).map(([sec]) => sec).slice(0, 1);
}

const segmentsOf = (line: string) => line.split(/\s{3,}|\t+/).map((x) => x.trim()).filter(Boolean);

// ---- Main ----

const STYLES = [
  "New England IPA", "West Coast IPA", "American IPA", "English IPA", "Double IPA", "Hazy IPA", "Black IPA", "Session IPA",
  "NEIPA", "DIPA", "American Pale Ale", "English Pale Ale", "Pale Ale", "Sweet Stout", "Milk Stout", "Oatmeal Stout",
  "Imperial Stout", "Dry Stout", "Stout", "Porter", "German Pilsner", "Czech Pilsner", "Pilsner", "Helles", "Märzen",
  "Dunkel", "Bock", "Lager", "Hefeweizen", "Witbier", "Wheat Beer", "Saison", "Belgian Tripel", "Belgian Dubbel",
  "Belgian Blonde", "Blonde Ale", "Amber Ale", "Red Ale", "Brown Ale", "Kölsch", "Kolsch", "Cream Ale", "Bitter",
  "Barleywine", "Sour", "Gose", "Berliner Weisse", "IPA",
];

type Item = RecipeDataIngredient & { _order: number };

export function parseRecipeText(text: string, known: KnownIngredient[] = []): ParsedRecipe {
  const checks: ImportCheck[] = [];
  const rangeNotes: string[] = [];
  const noteRange = (label: string, r: Range, unit = "", places = 3) => {
    if (!r.isRange) return;
    checks.push({ key: "{field} was a range ({range}) — used {value}", vars: { field: label, range: `${r.text}${unit}`, value: `${round(r.value, places)}${unit}` } });
    rangeNotes.push(`${label} ${r.text}${unit}`);
  };

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "")
    .filter((l) => !/(?:page|หน้า|หนา)\s*\d+\s*(?:of|จาก)\s*\d+/i.test(l));

  // ---- Name ----
  const labelled = lines.map((l) => /^\s*(?:recipe(?: name)?|name|ชื่อสูตร|ชื่อ)\s*[:：]\s*(.+)$/i.exec(l)).find(Boolean);
  const name = (labelled?.[1] ?? segmentsOf(lines[0] ?? "")[0] ?? "").replace(/^#+\s*/, "").trim() || "Imported recipe";

  // ---- Header rows: labels on one line, values under them on the next ----
  const facts: string[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const labels = segmentsOf(lines[i]);
    const values = segmentsOf(lines[i + 1]);
    const isLabel = (s: string) => /original gravity|final gravity|\bog\b|\bfg\b|abv|bitterness|\bibu\b|color|colour|\bsrm\b|\bebc\b/i.test(s);
    if (labels.length >= 2 && labels.length === values.length && labels.filter(isLabel).length >= 2) {
      labels.forEach((l, k) => facts.push(`${l}: ${values[k]}`));
    }
  }
  const all = [...facts, ...lines];
  const allLower = all.map(lower);

  const find = (re: RegExp) => {
    for (const l of allLower) {
      const r = matchRange(re, l);
      if (r) return r;
    }
    return null;
  };

  // ---- Numbers ----
  const sg = String.raw`(1\.\d{3})(?:\s*-\s*(1\.\d{3}))?`;
  const og = find(new RegExp(String.raw`(?:original gravity|\bog\b)[^0-9]{0,20}?~?\s*${sg}`));
  const fg = find(new RegExp(String.raw`(?:final gravity|\bfg\b)[^0-9]{0,20}?~?\s*${sg}`));
  const ibu = find(new RegExp(String.raw`${RANGE}\s*ibu\b`)) ?? find(new RegExp(String.raw`(?:ibu|bitterness)[^0-9]{0,15}${RANGE}`));
  const srmR = find(new RegExp(String.raw`${RANGE}\s*srm\b`)) ?? find(new RegExp(String.raw`\bsrm[^0-9]{0,10}${RANGE}`));
  const ebcR = srmR ? null : find(new RegExp(String.raw`${RANGE}\s*ebc\b`)) ?? find(new RegExp(String.raw`\bebc[^0-9]{0,10}${RANGE}`));
  if (og) noteRange("OG", og);
  if (fg) noteRange("FG", fg);
  if (ibu) noteRange("IBU", ibu, "", 0);

  let batch = find(new RegExp(String.raw`batch(?:\s*(?:volume|size))?\s*[:：]?\s*${RANGE}\s*(?:l|ลิตร|liters?|litres?)(?![a-z/])`));
  batch ??= find(new RegExp(String.raw`ขนาด\s*${RANGE}\s*ลิตร`));
  batch ??= find(new RegExp(String.raw`${RANGE}\s*(?:l|ลิตร|liters?|litres?)\s*batch`));
  if (!batch) checks.push({ key: "No batch size found — assumed {n} L", vars: { n: 20 } });

  // Carbonation: prefer the row marked as recommended in a serving table.
  const carbLines = allLower.filter((l) => new RegExp(String.raw`${NUM}\s*vol`).test(l));
  const carbLine = carbLines.find((l) => /แนะนำ|recommend/.test(l)) ?? carbLines[0];
  let co2 = carbLine ? matchRange(new RegExp(String.raw`${RANGE}\s*vol`), carbLine) : null;
  co2 ??= find(new RegExp(String.raw`carbonation[^0-9]{0,15}${RANGE}`));
  if (co2 && (co2.value < 1 || co2.value > 5)) co2 = null;

  // ---- Water ----
  let mashWater: Range | null = null;
  let spargeWater: Range | null = null;
  for (const l of lines) {
    for (const seg of segmentsOf(l).map(lower)) {
      const litres = new RegExp(String.raw`${RANGE}\s*(?:l|ลิตร|liters?|litres?)(?![a-z/])`);
      if (!mashWater && /mash water|strike water|นำ mash|นำแช/.test(seg)) mashWater = matchRange(litres, seg);
      if (!spargeWater && /sparge water|นำ sparge|นำลาง/.test(seg)) spargeWater = matchRange(litres, seg);
    }
  }
  if (mashWater) noteRange("Mash water", mashWater, " L");
  if (spargeWater) noteRange("Sparge water", spargeWater, " L");

  // ---- Walk the lines: sections, ingredients, mash and fermentation steps ----
  const items: Item[] = [];
  const hopTotals = new Map<string, number>();
  const mashSteps: RecipeData["mashSteps"] = [];
  const notes: string[] = [];
  let sections: Section[] = [];
  let dryHopDay: number | null = null;
  let dryHopActive = false;
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const l = lower(line);
    const segs = segmentsOf(line);
    const heads = segs.flatMap(headingSections);
    if (heads.length) {
      sections = heads;
      dryHopActive = false;
      if (heads.includes("notes")) continue;
    }
    const inSection = (s: Section) => sections.includes(s);

    if (inSection("notes") && !heads.length) {
      // Wrapped bullet text continues the previous note.
      if (notes.length && !/^\s*(?:[-•*·]|\d+[.)])\s/.test(line)) notes[notes.length - 1] += ` ${line.trim()}`;
      else notes.push(line.trim());
      continue;
    }
    if (inSection("keg") || inSection("serving")) continue;

    // Mash steps: "Mashing   65°C (60 นาที)".
    const temp = /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*°\s*c/.exec(l);
    const mins = /(\d+)\s*(?:min|minutes|นาที)/.exec(l);
    // Only the step and its time/temperature cells count; descriptions may mention sparging.
    const head = lower(segs.slice(0, 2).join(" "));
    if (temp && mins && /mash|sacchar|protein|beta|alpha|rest|หมักแป|แชขาว/.test(l) && !/sparge|strike|whirlpool|ferment/.test(head)) {
      const t = range(temp[1], temp[2]);
      const raw = segs[0].replace(/\d.*$/, "").replace(/[:：(]+\s*$/, "").trim();
      const stepName = /[a-z]/i.test(raw) ? raw : mashSteps.length === 0 ? "Saccharification" : "Mash step";
      if (t.isRange) noteRange(stepName, t, "°C");
      mashSteps.push({ name: stepName, temperature: round(t.value, 1), timeMin: Number(mins[1]) });
      continue;
    }

    // Context for hop timing on this line.
    if (/dry\s*-?\s*hop/.test(l)) {
      dryHopActive = true;
      const d = /(?:day|วันที|วัน)\s*(\d+)/.exec(l);
      if (d) dryHopDay = Number(d[1]);
    }
    const whirlpool = /whirlpool|flame\s*-?out|hop\s*stand|ดับไฟ/.test(l) || /flame\s*-?out|whirlpool/.test(lower(lines[i - 1] ?? "")) && /^\s*\d+\s*(?:min|นาที)/.test(l);
    const boilMin = mins ? Number(mins[1]) : /@\s*(\d+)/.exec(l) ? Number(/@\s*(\d+)/.exec(l)![1]) : null;
    const isBoil = /boil|ตม|ต้ม|fwh|first wort/.test(l) || (boilMin != null && !whirlpool);

    // Amounts on this line. Parenthesised weights after a pack ("1 ซอง (11.5g)") are details.
    const clean = line.replace(/\(\s*~?\d+(?:\.\d+)?\s*(?:g|กรัม)\s*\)/gi, "");
    const matches = [...clean.matchAll(AMOUNT)].filter((m) => unitOf(m[2]) != null);
    if (matches.length === 0) {
      if (dryHopActive && !/dry\s*-?\s*hop/.test(l) && !/^\s*[a-z]+\s*:/i.test(line)) dryHopActive = false;
      continue;
    }
    if (/batch|post-boil|pre-boil|ปริมาณ|สูญเสีย|ตอ\s|รวม|^total|\btotal\b(?! hops)/.test(l) && !inSection("hops")) continue;
    if (inSection("water")) continue;

    let lastEnd = 0;
    const lineItems: Item[] = [];
    let prevSegIdx = -1;
    for (const m of matches) {
      const unit = unitOf(m[2])!;
      const amount = Number(m[1]);
      const before = clean.slice(lastEnd, m.index);
      lastEnd = m.index! + m[0].length;
      // The name is the text just before the amount, or an earlier table cell when the amount has its own cell.
      let rawName = before.split(/\s{3,}|\s\+\s|[,;]/).pop() ?? "";
      if (!/[A-Za-z฀-๿]/.test(rawName.replace(/%/g, ""))) {
        const cells = segmentsOf(clean.slice(0, m.index));
        let k = cells.length - 1;
        while (k > prevSegIdx && k >= 0 && (FORM_ONLY.test(cells[k]) || !/[A-Za-z฀-๿]/.test(cells[k]) || /^\d/.test(cells[k]))) k--;
        rawName = k >= 0 && k > prevSegIdx ? cells[k] : "";
        prevSegIdx = cells.length;
      }
      let ingName = cleanName(rawName);
      if (!ingName || /^(?:ใส|ใส่|เติม|add)$/i.test(ingName)) continue;
      if (unit === "L" && !known.some((k) => nameScore(ingName, k.name) >= 0.95)) continue;

      let note: string | null = null;
      const alternatives = ingName.split(/\s+\/\s+|\s+or\s+|\s+หรือ\s+/i);
      if (alternatives.length > 1) {
        ingName = alternatives[0].trim();
        note = `or ${alternatives.slice(1).join(" / ")}`;
        checks.push({ key: "Had alternatives ({text}) — used {name}", vars: { text: alternatives.join(" / "), name: ingName } });
      }

      // Hop totals tables only confirm the additions.
      if (inSection("hops") && !inSection("schedule")) {
        const g = unit === "kg" ? amount * 1000 : amount;
        hopTotals.set(ingName, (hopTotals.get(ingName) ?? 0) + g);
        continue;
      }

      const hint = sections.find((s) => s !== "notes") ?? null;
      const { type, sure } = classify(ingName, unit, hint, known);
      if (!sure) {
        checks.push({ key: "Guessed that “{name}” is a {type}", vars: { name: ingName, type: INGREDIENT_TYPES.find((x) => x.value === type)!.label } });
      }

      let stage: AdditionStage;
      let additionTime: number | null = null;
      if (type === "GRAIN") stage = /extract|\bdme\b|\blme\b/i.test(ingName) ? "BOIL" : "MASH";
      else if (type === "YEAST") stage = "FERMENTATION";
      else if (type === "WATER") stage = /sparge/.test(l) ? "SPARGE" : "MASH";
      else if (dryHopActive) {
        stage = type === "HOP" ? "DRY_HOP" : "FERMENTATION";
        additionTime = dryHopDay;
      } else if (whirlpool) {
        stage = "WHIRLPOOL";
        additionTime = boilMin ?? 0;
      } else if (isBoil) {
        stage = "BOIL";
        additionTime = /fwh|first wort/.test(l) ? null : boilMin;
      } else {
        stage = "BOIL";
        if (type === "HOP") checks.push({ key: "Couldn't tell when to add {name} — set to the boil", vars: { name: ingName } });
      }

      // Text right after the amount ("(bittering)") is kept as a note.
      const after = clean.slice(lastEnd).split(/\s{3,}|\s\+\s/)[0]?.trim() ?? "";
      const tail = after.replace(/^\(|\)$/g, "").trim();
      if (!note && tail && !HAS_AMOUNT.test(tail) && tail.length <= 80 && !FORM_ONLY.test(tail)) note = tail;

      lineItems.push({
        _order: order++,
        name: ingName,
        type,
        brand: null,
        amount,
        unit,
        stage,
        additionTime,
        notes: note,
        alphaAcid: null,
        color: null,
        potential: null,
        attenuation: null,
        unfermentable: false,
      });
    }
    // Whirlpool instructions ("80–85°C for 15–20 min") apply to every addition on the line.
    if (whirlpool) {
      const shared = lineItems.map((x) => x.notes).find((n) => n && /°c|min|นาที/i.test(n));
      for (const x of lineItems) if (shared) x.notes = shared;
    }
    items.push(...lineItems);
  }

  // Drop exact duplicates (the same line in two places).
  const seen = new Set<string>();
  const ingredients = items.filter((i) => {
    const key = [i.name.toLowerCase(), i.amount, i.unit, i.stage, i.additionTime].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ---- Fermentation plan: numbered paragraphs in the fermentation section, or keyword lines anywhere ----
  const paragraphs: string[] = [];
  let inFerment = false;
  for (const line of lines) {
    const heads = segmentsOf(line).flatMap(headingSections);
    if (heads.length) {
      inFerment = heads.includes("ferment");
      continue;
    }
    const l = lower(line);
    const startsItem = /^\s*(?:\d+[.)]|[-•*])\s/.test(line);
    if (inFerment && !startsItem && paragraphs.length) paragraphs[paragraphs.length - 1] += ` ${l}`;
    else if (inFerment || /primary|ferment|dry\s*-?hop|cold crash|diacetyl|lager(?:ing)?\b|condition/.test(l)) paragraphs.push(l);
  }
  const fermentationSteps: RecipeData["fermentationSteps"] = [];
  const stepKinds: [string, RegExp][] = [
    ["Dry hop", /dry\s*-?\s*hop/],
    ["Cold crash", /cold\s*crash/],
    ["Diacetyl rest", /diacetyl|d-rest/],
    ["Lagering", /lagering|lager at/],
    ["Conditioning", /conditioning|condition at/],
    ["Primary", /primary|การเตรียมหมัก|หมักหลัก|ferment(?:ation)? at|ferment(?:ation)?\b/],
  ];
  for (const p of paragraphs) {
    const kind = stepKinds.find(([, re]) => re.test(p));
    if (!kind) continue;
    const t = matchRange(new RegExp(String.raw`${RANGE}\s*°\s*c`), p);
    const d = matchRange(new RegExp(String.raw`${RANGE}\s*(?:days?|วัน)(?!ที)`), p);
    if (!t && !d) continue;
    if (fermentationSteps.some((f) => f.name === kind[0])) continue;
    const temperature = t ? round(t.value, 1) : kind[0] === "Dry hop" ? (fermentationSteps.at(-1)?.temperature ?? null) : null;
    if (t) noteRange(kind[0], t, "°C");
    if (d) noteRange(kind[0], d, " days", 1);
    fermentationSteps.push({ name: kind[0], temperature, days: d ? round(d.value, 1) : null, notes: null });
  }
  // Dry hops added "on day 7" without a day in the text get the end of primary.
  const primaryDays = fermentationSteps.find((f) => f.name === "Primary")?.days ?? null;
  for (const i of ingredients) if (i.stage === "DRY_HOP" && i.additionTime == null && primaryDays != null) i.additionTime = Math.round(primaryDays);

  // ---- Boil time ----
  const explicitBoil = find(/boil(?:\s*time)?\s*[:：]\s*(\d+)\s*(?:min|นาที)/);
  const boilTimes = ingredients.filter((i) => i.stage === "BOIL" && i.additionTime != null).map((i) => i.additionTime!);
  const boilTime = explicitBoil ? Math.round(explicitBoil.value) : boilTimes.length ? Math.max(60, ...boilTimes) : 60;

  // ---- Hop totals should match the additions ----
  for (const [hop, total] of hopTotals) {
    const sum = ingredients
      .filter((i) => i.type === "HOP" && nameScore(i.name, hop) >= 0.95)
      .reduce((s, i) => s + (i.unit === "kg" ? i.amount * 1000 : i.unit === "g" ? i.amount : 0), 0);
    if (Math.abs(sum - total) > 0.5) {
      checks.push({ key: "Hop totals don't add up: {name} additions come to {sum} g, the sheet says {total} g", vars: { name: hop, sum: round(sum, 1), total: round(total, 1) } });
    }
  }

  // ---- Style ----
  const full = all.join("\n");
  const style = STYLES.find((s) => new RegExp(String.raw`(^|[^a-z])${s.replace(/ /g, "\\s+")}([^a-z]|$)`, "i").test(full)) ?? null;
  if (style) checks.push({ key: "Style guessed from the text: {style}", vars: { style } });

  if (ingredients.length === 0) checks.push({ key: "No ingredients found — add them in the editor below" });

  const notesText = [
    notes.join("\n"),
    rangeNotes.length ? `Ranges in the original: ${rangeNotes.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    data: {
      name,
      style,
      notes: notesText || null,
      versionNotes: null,
      batchSize: batch ? round(batch.value, 1) : 20,
      boilTime,
      targetOg: og ? round(og.value, 3) : null,
      targetFg: fg ? round(fg.value, 3) : null,
      targetIbu: ibu ? Math.round(ibu.value) : null,
      targetSrm: srmR ? Math.round(srmR.value) : ebcR ? Math.round(ebcR.value * 0.508) : null,
      targetCarbonation: co2 ? round(co2.value, 1) : null,
      waterSource: null,
      mashWaterL: mashWater ? round(mashWater.value, 1) : null,
      spargeWaterL: spargeWater ? round(spargeWater.value, 1) : null,
      targetMashPh: null,
      equipment: null,
      ingredients: ingredients.map(({ _order: _, ...rest }) => rest),
      mashSteps,
      fermentationSteps,
    },
    checks,
  };
}
