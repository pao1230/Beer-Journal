import { th } from "./th";

export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "lang";

type Vars = Record<string, string | number>;

/** English text is the key; Thai falls back to English when a phrase has no translation. */
export function translate(locale: Locale, key: string, vars?: Vars) {
  const text = locale === "th" ? (th[key] ?? key) : key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : text;
}

export function makeT(locale: Locale) {
  return (key: string, vars?: Vars) => translate(locale, key, vars);
}
export type T = ReturnType<typeof makeT>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Picks Thai when the browser lists it before English; English otherwise. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  const langs = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((l) => l.tag)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of langs) {
    if (tag.startsWith("th")) return "th";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}
