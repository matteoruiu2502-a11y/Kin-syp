"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { CheckCircle2, FileText, Loader2, Mic } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Cycle : écoute (onde vocale + transcription) → l'IA chiffre → PDF prêt.
const LISTEN = 3200;
const THINK = 1400;
const READY = 3800;
const TOTAL = LISTEN + THINK + READY;
const BARS = 44;

export function VoiceToPdf() {
  const { t } = useI18n();
  const v = t.features.voice;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-60px" });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now() - elapsed;
    const id = setInterval(() => setElapsed((performance.now() - start) % TOTAL), 60);
    return () => clearInterval(id);
  }, [inView]);

  const phase = elapsed < LISTEN ? "listening" : elapsed < LISTEN + THINK ? "thinking" : "ready";
  const typed = v.transcript.slice(0, Math.ceil((Math.min(elapsed, LISTEN) / LISTEN) * v.transcript.length));
  const readyProgress = phase === "ready" ? (elapsed - LISTEN - THINK) / READY : 0;

  return (
    <div ref={ref} className="grid h-full gap-4 md:grid-cols-[1.2fr_1fr]">
      {/* Téléphone : micro + onde vocale */}
      <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-ink/60 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("relative flex h-10 w-10 items-center justify-center rounded-full", phase === "listening" ? "bg-red-500/90" : "bg-white/10")}>
            {phase === "listening" && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/50" />}
            <Mic className="relative h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-semibold text-slate-200">
            {phase === "listening" ? v.listening : phase === "thinking" ? v.thinking : v.ready}
          </span>
          {phase === "thinking" && <Loader2 className="h-4 w-4 animate-spin text-cyan" />}
          {phase === "ready" && <CheckCircle2 className="h-4 w-4 text-emerald" />}
        </div>

        <div className="my-6 flex h-20 items-center justify-center gap-[3px]" aria-hidden>
          {Array.from({ length: BARS }, (_, i) => {
            const center = 1 - Math.abs(i - BARS / 2) / (BARS / 2);
            return (
              <motion.span
                key={i}
                className="w-[4px] rounded-full bg-gradient-to-t from-blue to-emerald"
                animate={
                  phase === "listening"
                    ? { height: [8, 12 + center * 60 * ((i * 37) % 10) / 10 + 6, 10, 18 + center * 40, 8] }
                    : { height: phase === "thinking" ? 6 + center * 10 : 4 }
                }
                transition={phase === "listening" ? { duration: 0.9 + ((i * 13) % 7) / 10, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
              />
            );
          })}
        </div>

        <p className="min-h-[3.5rem] text-sm leading-relaxed text-slate-300">
          {typed}
          {phase === "listening" && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-cyan" />}
        </p>
      </div>

      {/* PDF généré */}
      <div className="relative overflow-hidden theme-fixed rounded-2xl bg-white p-5 text-slate-800 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.5)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue">
            <FileText className="h-4 w-4" /> {v.quote}
          </span>
          <span className="h-6 w-14 rounded bg-gradient-to-r from-blue to-emerald" />
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="h-2 w-2/3 rounded bg-slate-200" />
          <div className="h-2 w-1/2 rounded bg-slate-100" />
        </div>
        <ul className="mt-5 space-y-2.5">
          <AnimatePresence>
            {v.pdfLines.map((line, i) =>
              readyProgress > i * 0.12 ? (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs"
                >
                  <span className="font-medium">{line}</span>
                  <span className="h-2 w-10 shrink-0 rounded bg-slate-200" />
                </motion.li>
              ) : null,
            )}
          </AnimatePresence>
        </ul>
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
            {phase === "thinking" ? <Loader2 className="h-8 w-8 animate-spin text-blue" /> : <FileText className="h-8 w-8 text-slate-300" />}
          </div>
        )}
        <motion.div
          className="mt-5 h-8 rounded-lg bg-gradient-to-r from-blue to-emerald"
          initial={false}
          animate={{ width: phase === "ready" ? `${Math.min(100, readyProgress * 260)}%` : "0%" }}
        />
      </div>
    </div>
  );
}
