"use client";

// Traduction de l'interface de l'espace artisan (FR / NL / DE).
// Les textes sont écrits en français dans le code ; NL et DE viennent de lib/app/tr-dict.ts.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DICT } from "./tr-dict";
import type { Lang } from "./types";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (fr: string, vars?: Record<string, string | number>) => string };
const TrContext = createContext<Ctx>({ lang: "fr", setLang: () => {}, t: (s) => s });
const KEY = "biltov.uiLang";

export function TrProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    try {
      // à défaut de choix dans l'espace, reprendre la langue choisie sur la page d'accueil
      const l = (localStorage.getItem(KEY) ?? localStorage.getItem("biltov.lang")) as Lang | null;
      if (l === "nl" || l === "de" || l === "fr") setLangState(l);
    } catch {}
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);
  const t = useCallback(
    (fr: string, vars?: Record<string, string | number>) => {
      const s = lang === "fr" ? fr : (DICT[fr]?.[lang === "nl" ? 0 : 1] ?? fr);
      return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : s;
    },
    [lang],
  );
  return <TrContext.Provider value={{ lang, setLang, t }}>{children}</TrContext.Provider>;
}

export const useTr = () => useContext(TrContext);
