"use client";

import { useTr } from "./tr";
import { LOCALE, fmtDate } from "./docText";
import { eur } from "./money";

/** Formats (montants, dates) dans la langue de l'interface. */
export function useFmt() {
  const { lang } = useTr();
  return {
    money: (n: number) => eur(n, LOCALE[lang]),
    money0: (n: number) => new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n),
    date: (iso: string) => fmtDate(iso, lang),
    num: (n: number, d = 2) => new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: d }).format(n),
    locale: LOCALE[lang],
  };
}
