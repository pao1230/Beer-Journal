"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { fmtDate } from "@/lib/brewing";
import { makeT, type Locale } from "./core";

const I18nContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const locale = useContext(I18nContext);
  return useMemo(() => ({ locale, t: makeT(locale), date: (d: Date) => fmtDate(d, locale) }), [locale]);
}
