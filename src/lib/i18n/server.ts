import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { fmtDate } from "@/lib/brewing";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, makeT, type Locale } from "./core";

export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: makeT(locale), date: (d: Date) => fmtDate(d, locale) };
}
