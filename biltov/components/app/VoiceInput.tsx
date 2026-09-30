"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Keyboard, Mic, Square, Wand2 } from "lucide-react";
import { useDictation } from "@/lib/app/useDictation";
import { useTr } from "@/lib/app/tr";
import { parseQuote, type ParsedQuote } from "@/lib/parseQuote";
import { cn } from "@/lib/utils";
import { inputClass } from "./ui";

const DICT_LANGS = [
  { id: "fr-BE", label: "FR" },
  { id: "nl-BE", label: "NL" },
  { id: "de-BE", label: "DE" },
  { id: "en-GB", label: "EN" },
];

/** Dictée d'un chantier ou de lignes de devis (micro si disponible, sinon clavier). */
export function VoiceInput({ onResult, compact }: { onResult: (r: ParsedQuote, text: string) => void; compact?: boolean }) {
  const { t, lang } = useTr();
  const [dLang, setDLang] = useState(lang === "nl" ? "nl-BE" : lang === "de" ? "de-BE" : "fr-BE");
  const { supported, listening, transcript, setTranscript, error, start, stop } = useDictation(dLang);
  const [typing, setTyping] = useState(false);
  const labour = t("Main-d'œuvre");
  const preview = parseQuote(transcript, labour);
  const [was, setWas] = useState(false);
  useEffect(() => {
    if (was && !listening && transcript.trim()) onResult(parseQuote(transcript, labour), transcript);
    setWas(listening);
  }, [listening]);

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-gradient-to-br from-blue/10 to-emerald/5 p-4", compact && "p-3")}>
      <div className="flex flex-wrap items-center gap-2">
        {supported && !typing ? (
          listening ? (
            <button type="button" onClick={stop} className="btn-ghost border-rose-500/40 !py-2 text-sm text-rose-300">
              <Square className="h-4 w-4 fill-current" /> {t("Terminer la dictée")}
            </button>
          ) : (
            <button type="button" onClick={start} className="btn-primary !py-2 text-sm">
              <Mic className="h-4 w-4" /> {t("Dicter")}
            </button>
          )
        ) : (
          <button type="button" onClick={() => transcript.trim() && onResult(parseQuote(transcript, labour), transcript)} disabled={!transcript.trim()} className="btn-primary !py-2 text-sm disabled:opacity-50">
            <Wand2 className="h-4 w-4" /> {t("Analyser la phrase")}
          </button>
        )}
        <select value={dLang} onChange={(e) => setDLang(e.target.value)} className={cn(inputClass, "!w-auto !py-2 text-xs")} aria-label={t("Langue de dictée")}>
          {DICT_LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              🎙 {l.label}
            </option>
          ))}
        </select>
        {supported && (
          <button type="button" onClick={() => setTyping((v) => !v)} className="btn-ghost !px-3 !py-2 text-xs">
            {typing ? <Mic className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />} {typing ? t("Micro") : t("Clavier")}
          </button>
        )}
        {listening && (
          <span className="flex items-center gap-2 text-xs text-emerald">
            <span className="flex h-3 items-end gap-[2px]">
              {[0, 1, 2, 3].map((b) => (
                <motion.span key={b} className="w-[3px] rounded-full bg-emerald" animate={{ height: [3, 12, 5, 10, 3] }} transition={{ duration: 0.8, repeat: Infinity, delay: b * 0.12 }} />
              ))}
            </span>
            {t("Biltov écoute…")}
          </span>
        )}
      </div>
      {supported && !typing ? (
        <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-slate-300">{transcript || <span className="text-slate-500">{t("Ex. : « Pour Mme Martin, 18 m² de faïence, un receveur de douche et 10 heures de main-d'œuvre »")}</span>}</p>
      ) : (
        <textarea className={cn(inputClass, "mt-3 resize-none")} rows={2} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={t("Pour Mme Martin, 18 m² de faïence et 10 heures de main-d'œuvre")} />
      )}
      {error && error !== "aborted" && <p className="mt-2 text-xs text-amber-300">{t("Micro indisponible")} ({error}). {t("Utilisez la saisie au clavier.")}</p>}
      {!supported && <p className="mt-2 text-xs text-slate-500">{t("La dictée au micro fonctionne dans Chrome, Edge et Safari. Ici, tapez la phrase : Biltov l'analyse de la même façon.")}</p>}
      {transcript && preview.lines.length > 0 && (
        <p className="mt-2 text-xs text-emerald">
          {preview.client ? `${t("Client")} : ${preview.client} · ` : ""}
          {t("{n} ligne(s) détectée(s) — rapprochées de votre catalogue", { n: preview.lines.length })}
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-600">{t("Reconnaissance vocale fournie par le navigateur (Chrome envoie l'audio à Google).")}</p>
    </div>
  );
}
