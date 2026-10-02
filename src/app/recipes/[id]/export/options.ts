/** Export screen options, kept in the URL so the preview is a normal server render. */
export const SHEET_LANGS = ["both", "th", "en"] as const;
export type SheetLang = (typeof SHEET_LANGS)[number];

export const SHEET_STYLES = ["recipe", "brewday"] as const;
export type SheetStyle = (typeof SHEET_STYLES)[number];

export const SECTIONS = ["notes", "ferment", "keg", "serving", "code"] as const;
export type Section = (typeof SECTIONS)[number];

export type ExportOptions = {
  v: number | null;
  size: number | null;
  lang: SheetLang;
  style: SheetStyle;
  /** Brew date (yyyy-mm-dd) to print real dates on the fermentation plan. */
  date: string | null;
  hide: Section[];
};

type Params = Record<string, string | string[] | undefined>;

const one = (p: Params, key: string) => {
  const v = p[key];
  return typeof v === "string" ? v : undefined;
};

export function parseExportOptions(p: Params): ExportOptions {
  const v = Number(one(p, "v"));
  const size = Number(one(p, "size"));
  const lang = one(p, "lang");
  const style = one(p, "style");
  const date = one(p, "date");
  return {
    v: Number.isInteger(v) && v > 0 ? v : null,
    size: Number.isFinite(size) && size > 0 && size <= 2000 ? size : null,
    lang: SHEET_LANGS.includes(lang as SheetLang) ? (lang as SheetLang) : "both",
    style: SHEET_STYLES.includes(style as SheetStyle) ? (style as SheetStyle) : "recipe",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : null,
    hide: (one(p, "hide") ?? "").split(",").filter((s): s is Section => SECTIONS.includes(s as Section)),
  };
}

/** Query string for the options, leaving out defaults. */
export function exportSearch(o: ExportOptions) {
  const q = new URLSearchParams();
  if (o.v != null) q.set("v", String(o.v));
  if (o.size != null) q.set("size", String(o.size));
  if (o.lang !== "both") q.set("lang", o.lang);
  if (o.style !== "recipe") q.set("style", o.style);
  if (o.date) q.set("date", o.date);
  if (o.hide.length) q.set("hide", o.hide.join(","));
  return q.toString();
}
