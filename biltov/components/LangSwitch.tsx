"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { LANGS, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangSwitch({ id = "lang-pill" }: { id?: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div role="group" aria-label={t.nav.language} className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
      <Globe className="mx-1.5 h-3.5 w-3.5 text-slate-500" aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          className={cn("relative rounded-full px-2.5 py-1 text-xs font-semibold transition-colors", lang === l.id ? "text-white" : "text-slate-400 hover:text-white")}
        >
          {lang === l.id && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-gradient-to-r from-blue to-emerald" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
          <span className="relative">{l.label}</span>
        </button>
      ))}
    </div>
  );
}
