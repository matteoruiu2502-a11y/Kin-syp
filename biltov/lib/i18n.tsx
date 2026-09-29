"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fr, type Dict } from "./content/fr";
import { en } from "./content/en";
import { de } from "./content/de";

export type Lang = "fr" | "en" | "de";
export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: "fr", label: "FR", locale: "fr-FR" },
  { id: "en", label: "EN", locale: "en-GB" },
  { id: "de", label: "DE", locale: "de-DE" },
];

const DICTS: Record<Lang, Dict> = { fr, en, de };
const STORAGE_KEY = "biltov.lang";

type I18n = { lang: Lang; locale: string; t: Dict; setLang: (l: Lang) => void };
const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && saved in DICTS) setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICTS[lang].meta.title;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const locale = LANGS.find((l) => l.id === lang)!.locale;
  return <I18nContext.Provider value={{ lang, locale, t: DICTS[lang], setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
