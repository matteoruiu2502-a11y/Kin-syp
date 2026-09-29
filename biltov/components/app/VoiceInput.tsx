"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Keyboard, Mic, Square, Wand2 } from "lucide-react";
import { useDictation } from "@/lib/app/useDictation";
import { parseQuote, type ParsedQuote } from "@/lib/parseQuote";
import { cn } from "@/lib/utils";
import { inputClass } from "./ui";

/**
 * Dictée d'un devis : « Pour Mme Martin, 24 m² de parquet à 45 euros et 6 heures à 50 euros ».
 * Micro si le navigateur le permet, saisie au clavier sinon. Renvoie client + lignes détectés.
 */
export function VoiceInput({ onResult, compact }: { onResult: (r: ParsedQuote, text: string) => void; compact?: boolean }) {
  const { supported, listening, transcript, setTranscript, error, start, stop } = useDictation("fr-FR");
  const [typing, setTyping] = useState(false);
  const preview = parseQuote(transcript, "Main d'œuvre");

  // Fin de dictée : on transmet automatiquement le résultat
  const [wasListening, setWasListening] = useState(false);
  useEffect(() => {
    if (wasListening && !listening && transcript.trim()) onResult(parseQuote(transcript, "Main d'œuvre"), transcript);
    setWasListening(listening);
  }, [listening]);

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-gradient-to-br from-blue/10 to-emerald/5 p-4", compact && "p-3")}>
      <div className="flex flex-wrap items-center gap-2">
        {supported && !typing ? (
          listening ? (
            <button type="button" onClick={stop} className="btn-ghost border-rose-500/40 !py-2 text-sm text-rose-300">
              <Square className="h-4 w-4 fill-current" /> Terminer la dictée
            </button>
          ) : (
            <button type="button" onClick={start} className="btn-primary !py-2 text-sm">
              <Mic className="h-4 w-4" /> Dicter
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => transcript.trim() && onResult(parseQuote(transcript, "Main d'œuvre"), transcript)}
            disabled={!transcript.trim()}
            className="btn-primary !py-2 text-sm disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" /> Analyser la phrase
          </button>
        )}
        {supported && (
          <button type="button" onClick={() => setTyping((v) => !v)} className="btn-ghost !px-3 !py-2 text-xs" title="Saisir au clavier">
            {typing ? <Mic className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />} {typing ? "Micro" : "Clavier"}
          </button>
        )}
        {listening && (
          <span className="flex items-center gap-2 text-xs text-emerald">
            <span className="flex h-3 items-end gap-[2px]">
              {[0, 1, 2, 3].map((b) => (
                <motion.span key={b} className="w-[3px] rounded-full bg-emerald" animate={{ height: [3, 12, 5, 10, 3] }} transition={{ duration: 0.8, repeat: Infinity, delay: b * 0.12 }} />
              ))}
            </span>
            Biltov écoute…
          </span>
        )}
      </div>

      {supported && !typing ? (
        <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-slate-300">
          {transcript || <span className="text-slate-500">Ex. : « Pour Mme Martin, 24 m² de parquet chêne à 45 euros, 12 ml de plinthes à 9 euros et 6 heures de main d&apos;œuvre à 50 euros »</span>}
        </p>
      ) : (
        <textarea
          className={cn(inputClass, "mt-3 resize-none")}
          rows={2}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Pour Mme Martin, 24 m² de parquet à 45 euros et 6 heures à 50 euros"
        />
      )}
      {error && error !== "aborted" && <p className="mt-2 text-xs text-amber-300">Micro indisponible ({error}). Utilisez la saisie au clavier.</p>}
      {!supported && <p className="mt-2 text-xs text-slate-500">La dictée au micro fonctionne dans Chrome, Edge et Safari. Ici, tapez la phrase : Biltov l&apos;analyse de la même façon.</p>}
      {transcript && preview.lines.length > 0 && (
        <p className="mt-2 text-xs text-emerald">
          {preview.client ? `Client : ${preview.client} · ` : ""}
          {preview.lines.length} ligne(s) détectée(s)
        </p>
      )}
    </div>
  );
}
